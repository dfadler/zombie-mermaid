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
  decodeXmlEntitiesInLabel,
  withDirectionOverride,
} from '@zombie-mermaid/core'
import type {
  Direction,
  MermaidGraph,
  MermaidSubgraph,
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
  if (axis === 'h') {
    mirrorLabelColumns(canvas, roles, rects, links)
    flipCanvasHorizontally(canvas, roles)
    flipRoleCanvasHorizontally(roles)
    if (links) flipLinkCanvasHorizontally(links)
  } else {
    mirrorLabelRows(canvas, roles, rects, links)
    flipCanvasVertically(canvas, roles)
    flipRoleCanvasVertically(roles)
    if (links) flipLinkCanvasVertically(links)
  }
  paste(graph.canvas, canvas)
  paste(graph.roleCanvas, roles)
  if (linkCanvas && links) paste(linkCanvas, links)
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
): string {
  // Normalize direction for grid layout.
  // BT is laid out as TD then flipped vertically after drawing.
  // RL is laid out as LR, then flipped horizontally after drawing.
  if (parsed.direction === 'LR' || parsed.direction === 'RL') {
    config.graphDirection = 'LR'
  } else {
    config.graphDirection = 'TD'
  }

  const graph = convertToAsciiGraph(parsed, config)
  createMapping(graph)
  drawGraph(graph)

  // Opt-in OSC 8 hyperlinks: mark each `click`-linked node's label cells
  // now, from the drawn node positions, before any flip below moves them.
  const linkCanvas = extras.hyperlinks
    ? buildNodeLinkCanvas(graph, parsed.interactions)
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
    flipCanvasVertically(graph.canvas, graph.roleCanvas)
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
    flipCanvasHorizontally(graph.canvas, graph.roleCanvas)
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
