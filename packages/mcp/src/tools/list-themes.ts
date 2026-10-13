// ============================================================================
// zombie-mermaid MCP server — `list_themes` tool
//
// Lists the built-in theme names render_mermaid_svg's `theme` argument
// accepts, straight from the library's own THEMES registry.
// ============================================================================

import { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { THEMES } from '@zombie-mermaid/core'

export const listThemesOutputShape = { themes: z.array(z.string()) }

/** MCP tool handler for `list_themes`: JSON `{ themes: string[] }`. */
export function listThemesHandler(): CallToolResult {
  const result = { themes: Object.keys(THEMES) }
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    structuredContent: result,
  }
}
