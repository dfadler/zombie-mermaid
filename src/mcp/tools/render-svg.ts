// ============================================================================
// zombie-mermaid MCP server — `render_mermaid_svg` tool
//
// Thin MCP adapter around the library's own renderMermaidSVG(). No new
// rendering logic lives here — this only maps a validated tool call onto
// RenderOptions and back onto an MCP CallToolResult.
// ============================================================================

import { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { renderMermaidSVG } from '../../index.ts'
import { THEMES } from '../../theme.ts'
import type { DiagramColors } from '../../theme.ts'

/**
 * Narrow a string array to zod's required non-empty-tuple shape without an
 * `as` assertion. `THEMES` always has entries (it's a populated module-level
 * const), but `Object.keys()` returns a plain `string[]` the type system
 * can't statically know is non-empty.
 */
function toNonEmptyStringTuple(values: string[]): [string, ...string[]] {
  const [first, ...rest] = values
  if (first === undefined) {
    throw new Error('Expected at least one built-in theme to be registered')
  }
  return [first, ...rest]
}

const themeNames = toNonEmptyStringTuple(Object.keys(THEMES))

export const renderSvgInputShape = {
  diagram: z
    .string()
    .min(1, 'diagram must not be empty')
    .describe(
      'Mermaid diagram source text, e.g. "graph TD\\n  A --> B". Supports ' +
        'flowcharts, state diagrams, sequence diagrams, class diagrams, ER ' +
        'diagrams, and XY charts.',
    ),
  theme: z
    .enum(themeNames)
    .optional()
    .describe(`Built-in theme name. One of: ${themeNames.join(', ')}`),
  transparent: z
    .boolean()
    .optional()
    .describe(
      'Render with a transparent background instead of the theme background color. Default: false.',
    ),
  font: z
    .string()
    .optional()
    .describe('Font family for diagram text. Default: "Inter".'),
}

export interface RenderSvgToolArgs {
  diagram: string
  theme?: string | undefined
  transparent?: boolean | undefined
  font?: string | undefined
}

/**
 * MCP tool handler for `render_mermaid_svg`. Renders Mermaid source to a
 * self-contained SVG string, returned as `text` content — SVG is XML text,
 * not the raster image the `image` content type expects.
 *
 * Catches rendering errors (e.g. invalid Mermaid syntax) and returns them
 * as an MCP tool error result (`isError: true`) instead of throwing, so a
 * bad diagram from the caller surfaces as a normal tool response rather
 * than a protocol-level failure.
 */
export function renderSvgHandler(input: RenderSvgToolArgs): CallToolResult {
  try {
    const themeColors: DiagramColors | undefined = input.theme
      ? THEMES[input.theme]
      : undefined
    const svg = renderMermaidSVG(input.diagram, {
      ...themeColors,
      transparent: input.transparent,
      font: input.font,
    })
    return { content: [{ type: 'text', text: svg }] }
  } catch (err) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Failed to render diagram to SVG: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    }
  }
}
