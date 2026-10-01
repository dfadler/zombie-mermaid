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

import { parseMermaid } from '../../../src/parser.ts'
import { withDirectionOverride } from '@zombie-mermaid/core'
import type { Direction, MermaidGraph } from '@zombie-mermaid/core'
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
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'

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
    withDirectionOverride(parseMermaid(text), extras.direction),
    config,
    colorMode,
    theme,
    extras,
  )
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
