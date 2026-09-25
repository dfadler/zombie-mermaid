// ============================================================================
// zombie-mermaid — public API
//
// Renders Mermaid diagrams to styled SVG strings.
// Framework-agnostic, no DOM required. Pure TypeScript.
//
// Supported diagram types:
//   - Flowcharts (graph TD / flowchart LR)
//   - State diagrams (stateDiagram-v2)
//   - Sequence diagrams (sequenceDiagram)
//   - Class diagrams (classDiagram)
//   - ER diagrams (erDiagram)
//
// Theming uses CSS custom properties (--bg, --fg, + optional enrichment).
// See packages/core/src/theme.ts for the full variable system.
//
// Usage:
//   import { renderMermaidSVG } from 'zombie-mermaid'
//   const svg = renderMermaidSVG('graph TD\n  A --> B')
// ============================================================================

export type {
  RenderOptions,
  MermaidGraph,
  NodeInteraction,
  PositionedGraph,
  Direction,
  CommonRenderOptions,
  FlowchartRenderOptions,
  SequenceRenderOptions,
  ClassRenderOptions,
  ErRenderOptions,
  XyChartRenderOptions,
} from '@zombie-mermaid/core'
export type { DiagramColors, ThemeName } from '@zombie-mermaid/core'
export { fromShikiTheme, THEMES, DEFAULTS } from '@zombie-mermaid/core'
export { parseMermaid } from './parser.ts'
export {
  renderMermaidASCII,
  renderMermaidAscii,
} from '@zombie-mermaid/ascii-renderer'
export type { AsciiRenderOptions } from '@zombie-mermaid/ascii-renderer'
export { createLayoutCache } from '@zombie-mermaid/svg-renderer'
export type { LayoutCache } from '@zombie-mermaid/svg-renderer'

// The SVG dispatch table (diagram-type registry) and the
// `renderMermaidSVG`/`renderMermaidSVGAsync`/`themeCssVariables` front door
// built on it moved to `@zombie-mermaid/svg-renderer` under issue #1111 —
// parity with how `renderMermaidASCII` already lives entirely in
// `@zombie-mermaid/ascii-renderer` (re-exported above), not duplicated here.
export {
  renderMermaidSVG,
  renderMermaidSVGAsync,
  themeCssVariables,
  renderMermaidSync,
  renderMermaid,
} from '@zombie-mermaid/svg-renderer'
