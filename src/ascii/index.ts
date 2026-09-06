// ============================================================================
// zombie-mermaid — ASCII renderer public API
//
// Renders Mermaid diagrams to ASCII or Unicode box-drawing art.
// No external dependencies — pure TypeScript.
//
// Supported diagram types:
//   - Flowcharts (graph TD / flowchart LR) — grid-based layout with A* pathfinding
//   - State diagrams (stateDiagram-v2) — same pipeline as flowcharts
//   - Sequence diagrams (sequenceDiagram) — column-based timeline layout
//   - Class diagrams (classDiagram) — level-based UML layout
//   - ER diagrams (erDiagram) — grid layout with crow's foot notation
//
// Usage:
//   import { renderMermaidASCII } from 'zombie-mermaid'
//   const ascii = renderMermaidASCII('graph LR\n  A --> B')
// ============================================================================

import { parseMermaid } from '../parser.ts'
import { withDirectionOverride } from '../direction-override.ts'
import type { Direction } from '../types.ts'
import { detectDiagramType } from '../diagram-type.ts'
import type { DiagramType } from '../diagram-type.ts'
import { convertToAsciiGraph } from './converter.ts'
import { createMapping } from './grid.ts'
import { drawGraph } from './draw.ts'
import {
  canvasToString,
  flipCanvasVertically,
  flipRoleCanvasVertically,
} from './canvas.ts'
import { renderSequenceAscii } from './sequence.ts'
import { renderClassAscii } from './class-diagram.ts'
import { renderErAscii } from './er-diagram.ts'
import { renderXYChartAscii } from './xychart.ts'
import { addCoordsOverlay } from './coords.ts'
import { buildNodeLinkCanvas, flipLinkCanvasVertically } from './hyperlinks.ts'
import {
  detectColorMode,
  DEFAULT_ASCII_THEME,
  diagramColorsToAsciiTheme,
} from './ansi.ts'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import {
  DEFAULT_PADDING_X,
  DEFAULT_PADDING_Y,
  DEFAULT_BOX_BORDER_PADDING,
} from './types.ts'

// Re-export types for external use
export type { AsciiTheme, ColorMode }
export { DEFAULT_ASCII_THEME, detectColorMode, diagramColorsToAsciiTheme }

export interface AsciiRenderOptions {
  /** true = ASCII chars (+,-,|,>), false = Unicode box-drawing (┌,─,│,►). Default: false */
  useAscii?: boolean
  /** Horizontal spacing between nodes. Default: 5 */
  paddingX?: number
  /** Vertical spacing between nodes. Default: 5 */
  paddingY?: number
  /** Padding inside node boxes. Default: 1 */
  boxBorderPadding?: number
  /**
   * Color mode for output.
   * - 'none': No colors (plain text)
   * - 'auto': Auto-detect (terminal ANSI capabilities, or HTML in browsers)
   * - 'ansi16': 16-color ANSI
   * - 'ansi256': 256-color xterm
   * - 'truecolor': 24-bit RGB
   * - 'html': HTML <span> tags with inline color styles (for browser rendering)
   * Default: 'auto'
   */
  colorMode?: ColorMode | 'auto'
  /** Theme colors for ASCII output. Uses default theme if not provided. */
  theme?: Partial<AsciiTheme>
  /**
   * Overlay spreadsheet-style row/column indices on the rendered output, to
   * help debug layout spacing. Off by default.
   */
  showCoords?: boolean
  /**
   * Force the diagram's layout direction, overriding the one its source
   * declares (a flowchart's `graph LR` header, or a state diagram's
   * top-level `direction LR` line). Applied after parsing and before
   * layout — the source text is never rewritten. Replaces only the
   * top-level direction: a nested subgraph's or composite state's own
   * `direction` line still applies on top of it, exactly as it does on top
   * of the diagram's own header.
   *
   * Flowchart and state diagrams only in ASCII output. The ASCII ER layout
   * has no direction concept (it already ignores a source `direction`
   * line), and sequence/class/XY-chart diagrams have none to override, so
   * all of those ignore this option (no error; output is identical with or
   * without it). Same semantics as `RenderOptions.direction` for SVG. See
   * issue #276.
   */
  direction?: Direction
  /**
   * Emit OSC 8 terminal hyperlinks: each node whose `click` directive
   * declared an http/https/mailto/relative href gets its label wrapped in
   * an `ESC ] 8 ; ; <url> ESC \` … `ESC ] 8 ; ; ESC \` pair, which
   * terminals that support OSC 8 (iTerm2, WezTerm, kitty, Windows
   * Terminal, VTE-based terminals) render as a clickable link. The
   * sequences are zero-width and never affect layout; `click ... call fn()`
   * bindings emit nothing. Off by default — not every terminal or pager
   * handles OSC 8 gracefully (`less` needs `-R`), and no capability
   * detection is attempted here; the caller decides. Ignored when
   * `colorMode` is 'html'.
   */
  hyperlinks?: boolean
}

/**
 * Render Mermaid diagram text to an ASCII/Unicode string.
 *
 * Synchronous — no async layout engine needed (unlike the SVG renderer).
 * Auto-detects diagram type from the header line and dispatches to
 * the appropriate renderer.
 *
 * @param text - Mermaid source text (any supported diagram type)
 * @param options - Rendering options
 * @returns Multi-line ASCII/Unicode string
 *
 * @example
 * ```ts
 * const result = renderMermaidASCII(`
 *   graph LR
 *     A --> B --> C
 * `, { useAscii: true })
 *
 * // Output:
 * // +---+     +---+     +---+
 * // |   |     |   |     |   |
 * // | A |---->| B |---->| C |
 * // |   |     |   |     |   |
 * // +---+     +---+     +---+
 * ```
 */
export function renderMermaidASCII(
  text: string,
  options: AsciiRenderOptions = {},
): string {
  const config: AsciiConfig = {
    useAscii: options.useAscii ?? false,
    paddingX: options.paddingX ?? DEFAULT_PADDING_X,
    paddingY: options.paddingY ?? DEFAULT_PADDING_Y,
    boxBorderPadding: options.boxBorderPadding ?? DEFAULT_BOX_BORDER_PADDING,
    graphDirection: 'TD', // default, overridden for flowcharts below
  }

  // Resolve color mode ('auto' or unset → detect environment, otherwise use specified mode)
  const colorMode: ColorMode =
    options.colorMode === 'auto' || options.colorMode === undefined
      ? detectColorMode()
      : options.colorMode

  // Merge user theme with defaults
  const theme: AsciiTheme = { ...DEFAULT_ASCII_THEME, ...options.theme }

  const diagramType: DiagramType = detectDiagramType(text)

  let result: string

  switch (diagramType) {
    case 'xychart':
      result = renderXYChartAscii(text, config, colorMode, theme)
      break

    case 'sequence':
      result = renderSequenceAscii(text, config, colorMode, theme)
      break

    case 'class':
      result = renderClassAscii(text, config, colorMode, theme, {
        hyperlinks: options.hyperlinks ?? false,
      })
      break

    case 'er':
      result = renderErAscii(text, config, colorMode, theme)
      break

    case 'flowchart':
    default: {
      // Flowchart + state diagram pipeline (original). `options.direction`
      // replaces the parsed top-level direction before layout; see
      // src/direction-override.ts.
      const parsed = withDirectionOverride(
        parseMermaid(text),
        options.direction,
      )

      // Normalize direction for grid layout.
      // BT is laid out as TD then flipped vertically after drawing.
      // RL is treated as LR (full RL support not yet implemented).
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
      const linkCanvas = options.hyperlinks
        ? buildNodeLinkCanvas(graph, parsed.interactions)
        : undefined

      // BT: flip the finished canvas vertically so the flow runs bottom→top.
      // The grid layout ran as TD; flipping + character remapping produces BT.
      if (parsed.direction === 'BT') {
        flipCanvasVertically(graph.canvas)
        flipRoleCanvasVertically(graph.roleCanvas)
        if (linkCanvas) flipLinkCanvasVertically(linkCanvas)
      }

      result = canvasToString(graph.canvas, {
        roleCanvas: graph.roleCanvas,
        colorMode,
        theme,
        linkCanvas,
      })
    }
  }

  return options.showCoords ? addCoordsOverlay(result) : result
}

/** @deprecated Use `renderMermaidASCII` */
export const renderMermaidAscii = renderMermaidASCII
