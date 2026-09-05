// ============================================================================
// zombie-mermaid MCP server — `render_mermaid_ascii` tool
//
// Thin MCP adapter around the library's own renderMermaidASCII(). No new
// rendering logic lives here — this only maps a validated tool call onto
// AsciiRenderOptions and back onto an MCP CallToolResult.
// ============================================================================

import { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { renderMermaidASCII } from '../../ascii/index.ts'
import type { AsciiRenderOptions } from '../../ascii/index.ts'

export const renderAsciiInputShape = {
  diagram: z
    .string()
    .min(1, 'diagram must not be empty')
    .describe(
      'Mermaid diagram source text, e.g. "graph LR\\n  A --> B". Supports ' +
        'flowcharts, state diagrams, sequence diagrams, class diagrams, and ' +
        'ER diagrams.',
    ),
  useAscii: z
    .boolean()
    .optional()
    .describe(
      'true = plain ASCII characters (+, -, |, >); false/unset = Unicode ' +
        'box-drawing characters (┌, ─, │, ►). Default: false.',
    ),
  paddingX: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      'Horizontal spacing between nodes. Default: 5. Flowchart/state diagrams only.',
    ),
  paddingY: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      'Vertical spacing between nodes. Default: 5. Flowchart/state diagrams only.',
    ),
  boxBorderPadding: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      'Padding inside node boxes. Default: 1. Flowchart/state diagrams only.',
    ),
}

export interface RenderAsciiToolArgs {
  diagram: string
  useAscii?: boolean | undefined
  paddingX?: number | undefined
  paddingY?: number | undefined
  boxBorderPadding?: number | undefined
}

/**
 * MCP tool handler for `render_mermaid_ascii`. Renders Mermaid source to a
 * plain ASCII/Unicode-art string.
 *
 * Color mode is deliberately fixed to `'none'` rather than exposed as an
 * option: the CLI's `--theme` flag produces ANSI color escapes meant for a
 * real terminal, but an MCP tool result is text inserted into a chat/agent
 * context, where raw ANSI escapes would render as garbage rather than
 * color. (In practice `renderMermaidASCII`'s own auto-detection already
 * resolves to `'none'` here, since the MCP server's stdout is a pipe used
 * for the JSON-RPC transport, not a TTY — this makes that outcome explicit
 * instead of incidental.)
 */
export function renderAsciiHandler(input: RenderAsciiToolArgs): CallToolResult {
  try {
    const options: AsciiRenderOptions = {
      useAscii: input.useAscii,
      paddingX: input.paddingX,
      paddingY: input.paddingY,
      boxBorderPadding: input.boxBorderPadding,
      colorMode: 'none',
    }
    const ascii = renderMermaidASCII(input.diagram, options)
    return { content: [{ type: 'text', text: ascii }] }
  } catch (err) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Failed to render diagram to ASCII: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    }
  }
}
