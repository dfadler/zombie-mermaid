// ============================================================================
// zombie-mermaid MCP server — `list_diagram_types` tool
//
// Lists the diagram types the library can detect, derived from core's
// DIAGRAM_TYPES (the source `DiagramType` is built from) rather than a
// second hard-coded list.
// ============================================================================

import { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { DIAGRAM_TYPES } from '@zombie-mermaid/core'

export const listDiagramTypesOutputShape = {
  diagramTypes: z.array(z.string()),
}

/** MCP tool handler for `list_diagram_types`: JSON `{ diagramTypes }`. */
export function listDiagramTypesHandler(): CallToolResult {
  const result = { diagramTypes: [...DIAGRAM_TYPES] }
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    structuredContent: result,
  }
}
