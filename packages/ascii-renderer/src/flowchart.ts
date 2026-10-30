// ============================================================================
// ASCII renderer — Flowchart / state diagram
//
// Renders flowcharts (graph TD / flowchart LR) and state diagrams
// (stateDiagram-v2) to ASCII/Unicode box-drawing art via the shared
// grid-based layout + A* pathfinding pipeline (converter -> grid -> draw).
//
// Extracted from the inline sequence that used to live directly in
// `renderMermaidASCII`'s switch/fallback (src/ascii/index.ts) so flowchart
// can be registered in `asciiRegistry` (src/ascii/registry.ts) alongside
// every other diagram type — see
// docs/decisions/diagram-type-registry-partial.md and issue #745. A pure,
// behavior-preserving extraction: same functions, same call order, same
// arguments.
// ============================================================================

import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import {
  checkGraphSize,
  checkLimit,
  decodeXmlEntitiesInLabel,
  withDirectionOverride,
} from '@zombie-mermaid/core'
import type {
  Direction,
  MermaidGraph,
  MermaidSubgraph,
  RenderLimits,
} from '@zombie-mermaid/core'
import { convertToAsciiGraph } from './converter.ts'
import { createMapping } from './grid.ts'
import { drawGraph } from './draw.ts'
import {
  canvasToString,
  flipCanvasVertically,
  flipCanvasHorizontally,
  mirrorLabelRows,
  mirrorLabelColumns,
  flipRoleCanvasVertically,
  flipRoleCanvasHorizontally,
} from './canvas.ts'
import {
  buildNodeLinkCanvas,
  flipLinkCanvasHorizontally,
  flipLinkCanvasVertically,
} from './hyperlinks.ts'
import type {
  AsciiConfig,
  AsciiGraph,
  AsciiNode,
  AsciiSubgraph,
  AsciiTheme,
  ColorMode,
} from './types.ts'

/**
 * Flowchart-only ASCII extras: `direction` (override the parsed top-level
 * direction, same semantics as `RenderOptions.direction` for SVG — see
 * issue #276) and `hyperlinks` (OSC 8 terminal links). No other registered
 * ASCII type reads `direction`; `hyperlinks` is shared with `class` (see
 * `AsciiRenderExtras` in ./registry.ts).
 */
export interface FlowchartAsciiExtras {
  direction?: Direction
  hyperlinks?: boolean
  limits?: RenderLimits
}

/**
 * Decode `&quot;`-style entities in each parsed label, as the SVG renderer's
 * source-level decode does. Done per label after parsing so the characters
 * it produces can't change how the source parses.
 */
function decodeGraphLabelEntities(graph: MermaidGraph): MermaidGraph {
  for (const node of graph.nodes.values()) {
    node.label = decodeXmlEntitiesInLabel(node.label)
  }
  for (const edge of graph.edges) {
    if (edge.label) edge.label = decodeXmlEntitiesInLabel(edge.label)
  }
  const walk = (subgraphs: MermaidSubgraph[]): void => {
    for (const sg of subgraphs) {
      sg.label = decodeXmlEntitiesInLabel(sg.label)
      walk(sg.children)
    }
  }
  walk(graph.subgraphs)
  return graph
}

/**
 * Render a flowchart or state diagram to ASCII/Unicode text art.
 *
 * Matches every other diagram type's ASCII entry-point shape
 * (`text, config, colorMode, theme, extras`) so it can slot into
 * `asciiRegistry` — see ./registry.ts.
 */
export function renderFlowchartAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
  extras: FlowchartAsciiExtras = {},
): string {
  // `extras.direction` replaces the parsed top-level direction before
  // layout; see packages/core/src/direction-override.ts.
  return renderGraphAscii(
    withDirectionOverride(
      decodeGraphLabelEntities(parseMermaid(text)),
      extras.direction,
    ),
    config,
    colorMode,
    theme,
    extras,
  )
}

/**
 * Mirror each honored `direction RL`/`BT` subgraph's own box in place (#1421).
 * An honored override means no edge crosses the box, so its contents are
 * self-contained. The flip is relative to what the surrounding output already
 * shows: `h`/`v` say whether an ancestor (or the root) mirrors this region, so
 * `RL` inside `RL` flips nothing and `LR` inside `RL` flips back. Inner boxes
 * flip first, while the coordinates of the outer one are still valid.
 */
function flipSubgraphRegions(
  graph: AsciiGraph,
  linkCanvas: (string | null)[][] | undefined,
  rootDir: Direction,
): void {
  const visit = (sg: AsciiSubgraph, h0: boolean, v0: boolean): void => {
    const d = sg.rawDirection
    let h = h0
    let v = v0
    let flip: 'h' | 'v' | undefined
    if (d === 'LR' || d === 'RL') {
      if ((d === 'RL') !== h) flip = 'h'
      h = d === 'RL'
    } else if (d === 'TD' || d === 'BT') {
      if ((d === 'BT') !== v) flip = 'v'
      v = d === 'BT'
    }
    for (const c of sg.children) visit(c, h, v)
    if (flip) flipRegion(graph, linkCanvas, sg, flip)
  }
  for (const sg of graph.subgraphs) {
    if (!sg.parent) visit(sg, rootDir === 'RL', rootDir === 'BT')
  }
}

function flipRegion(
  graph: AsciiGraph,
  linkCanvas: (string | null)[][] | undefined,
  { minX, minY, maxX, maxY }: AsciiSubgraph,
  axis: 'h' | 'v',
): void {
  const cut = <T>(layer: T[][]): T[][] =>
    layer.slice(minX, maxX + 1).map((col) => col.slice(minY, maxY + 1))
  const paste = <T>(layer: T[][], sub: T[][]): void => {
    for (const [i, col] of sub.entries()) {
      for (const [j, cell] of col.entries()) layer[minX + i]![minY + j] = cell
    }
  }
  const canvas = cut(graph.canvas)
  const roles = cut(graph.roleCanvas)
  const links = linkCanvas ? cut(linkCanvas) : undefined
  const rects = (graph.labelRects ?? [])
    .filter((r) => r.x0 >= minX && r.x1 <= maxX && r.y0 >= minY && r.y1 <= maxY)
    .map((r) => ({
      x0: r.x0 - minX,
      x1: r.x1 - minX,
      y0: r.y0 - minY,
      y1: r.y1 - minY,
    }))
  const nodeRects = graph
    .nodeRects!.filter(
      (r) => r.x0 >= minX && r.x1 <= maxX && r.y0 >= minY && r.y1 <= maxY,
    )
    .map((r) => ({
      ...r,
      x0: r.x0 - minX,
      x1: r.x1 - minX,
      y0: r.y0 - minY,
      y1: r.y1 - minY,
    }))
  if (axis === 'h') {
    mirrorLabelColumns(canvas, roles, rects, links)
    flipCanvasHorizontally(canvas, roles, nodeRects)
    flipRoleCanvasHorizontally(roles)
    if (links) flipLinkCanvasHorizontally(links)
  } else {
    mirrorLabelRows(canvas, roles, rects, links)
    flipCanvasVertically(canvas, roles, nodeRects)
    flipRoleCanvasVertically(roles)
    if (links) flipLinkCanvasVertically(links)
  }
  // Node boxes inside the region moved with it; keep their rects in step.
  for (const r of graph.nodeRects!) {
    if (!(r.x0 >= minX && r.x1 <= maxX && r.y0 >= minY && r.y1 <= maxY))
      continue
    const { x0, x1, y0, y1 } = r
    if (axis === 'h') {
      r.x0 = minX + maxX - x1
      r.x1 = minX + maxX - x0
    } else {
      r.y0 = minY + maxY - y1
      r.y1 = minY + maxY - y0
    }
  }
  paste(graph.canvas, canvas)
  paste(graph.roleCanvas, roles)
  if (linkCanvas && links) paste(linkCanvas, links)
}

/**
 * Steps a diagram type that lowers onto the flowchart model can add around the
 * shared pipeline (the class diagram's LR/RL drawing, class-flow.ts).
 * `afterConvert` runs on every freshly converted graph, before layout;
 * `afterDraw` once the canvas is drawn, before any direction flip.
 */
export interface GraphHooks {
  afterConvert?: (graph: AsciiGraph) => void
  afterDraw?: (graph: AsciiGraph) => void
  /** Rows of a node to hyperlink instead of every interior row. */
  linkRows?: (node: AsciiNode) => { from: number; to: number } | undefined
}

/**
 * Render an already-parsed graph to ASCII text art. Shared by the diagram
 * types that lower to the flowchart model (see `renderArchitectureAscii`).
 */
export function renderGraphAscii(
  parsed: MermaidGraph,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
  extras: FlowchartAsciiExtras,
  hooks: GraphHooks = {},
): string {
  // Normalize direction for grid layout.
  // BT is laid out as TD then flipped vertically after drawing.
  // RL is laid out as LR, then flipped horizontally after drawing.
  if (parsed.direction === 'LR' || parsed.direction === 'RL') {
    config.graphDirection = 'LR'
  } else {
    config.graphDirection = 'TD'
  }

  checkGraphSize(parsed.nodes.size, parsed.edges.length, extras.limits)
  let graph = convertToAsciiGraph(parsed, config)
  hooks.afterConvert?.(graph)
  createMapping(graph)
  // Flow-axis face lanes (#2121) that did not come out as planned are dropped
  // and the layout redone, so the room planned for them is not left behind.
  const off = new Set<number>()
  // A self-loop that wants a top face on the first row gets a free row above
  // the nodes, and the layout is redone (#2100).
  const margin = graph.wantsTopMargin === true
  if (margin) {
    graph = convertToAsciiGraph(parsed, config)
    hooks.afterConvert?.(graph)
    graph.topMargin = true
    createMapping(graph)
  }
  for (let pass = 0; pass < 4 && graph.faceLaneRejected?.size; pass++) {
    for (const i of graph.faceLaneRejected) off.add(i)
    graph = convertToAsciiGraph(parsed, config)
    hooks.afterConvert?.(graph)
    graph.faceLaneOff = new Set(off)
    graph.topMargin = margin
    createMapping(graph)
  }
  // The canvas is allocated from the finished grid; check its size before
  // drawing fills it (memory is what runs out, not time).
  const sum = (m: Map<number, number>) =>
    [...m.values()].reduce((a, b) => a + b, 0)
  checkLimit(
    'maxCanvasCells',
    (sum(graph.columnWidth) + graph.offsetX) *
      (sum(graph.rowHeight) + graph.offsetY),
    extras.limits,
  )
  drawGraph(graph)
  hooks.afterDraw?.(graph)

  // Opt-in OSC 8 hyperlinks: mark each `click`-linked node's label cells
  // now, from the drawn node positions, before any flip below moves them.
  const linkCanvas = extras.hyperlinks
    ? buildNodeLinkCanvas(graph, parsed.interactions, hooks.linkRows)
    : undefined

  flipSubgraphRegions(graph, linkCanvas, parsed.direction)

  // BT: flip the finished canvas vertically so the flow runs bottom→top.
  // The grid layout ran as TD; flipping + character remapping produces BT.
  if (parsed.direction === 'BT') {
    mirrorLabelRows(
      graph.canvas,
      graph.roleCanvas,
      graph.labelRects ?? [],
      linkCanvas,
    )
    flipCanvasVertically(graph.canvas, graph.roleCanvas, graph.nodeRects!)
    flipRoleCanvasVertically(graph.roleCanvas)
    if (linkCanvas) flipLinkCanvasVertically(linkCanvas)
  }

  // RL: flip the finished canvas horizontally so the flow runs right→left.
  if (parsed.direction === 'RL') {
    mirrorLabelColumns(
      graph.canvas,
      graph.roleCanvas,
      graph.labelRects ?? [],
      linkCanvas,
    )
    flipCanvasHorizontally(graph.canvas, graph.roleCanvas, graph.nodeRects!)
    flipRoleCanvasHorizontally(graph.roleCanvas)
    if (linkCanvas) flipLinkCanvasHorizontally(linkCanvas)
  }

  return canvasToString(graph.canvas, {
    roleCanvas: graph.roleCanvas,
    colorMode,
    theme,
    linkCanvas,
  })
}
