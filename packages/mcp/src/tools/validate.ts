// ============================================================================
// zombie-mermaid MCP server — `validate_mermaid` tool
//
// Parse only: no layout, no drawing, no file writes. Returns
// `{ valid, diagnostics }` as a normal (non-error) result so a caller can
// branch on `valid` without treating bad Mermaid as a tool failure.
// ============================================================================

import { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { validateMermaid } from '@zombie-mermaid/svg-renderer'
import { extractParseDiagnostic } from './parse-diagnostics.ts'

export const validateInputShape = {
  diagram: z
    .string()
    .describe('Mermaid diagram source text to check without rendering.'),
}

export function validateHandler(input: { diagram: string }): CallToolResult {
  let result: object
  if (input.diagram.trim().length === 0) {
    result = {
      valid: false,
      diagnostics: [{ message: 'diagram must not be empty' }],
    }
    return { content: [{ type: 'text', text: JSON.stringify(result) }] }
  }
  try {
    validateMermaid(input.diagram)
    result = { valid: true, diagnostics: [] }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const d = extractParseDiagnostic(message, input.diagram)
    result = { valid: false, diagnostics: [d ?? { message }] }
  }
  return { content: [{ type: 'text', text: JSON.stringify(result) }] }
}
