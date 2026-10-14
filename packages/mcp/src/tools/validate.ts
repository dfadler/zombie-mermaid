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

export const validateOutputShape = {
  valid: z.boolean(),
  diagnostics: z.array(
    z.object({
      line: z.number().optional(),
      sourceLine: z.string().optional(),
      message: z.string(),
    }),
  ),
}

function ok(result: { valid: boolean; diagnostics: object[] }): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    structuredContent: result,
  }
}

export function validateHandler(input: { diagram: string }): CallToolResult {
  if (input.diagram.trim().length === 0) {
    return ok({
      valid: false,
      diagnostics: [{ message: 'diagram must not be empty' }],
    })
  }
  try {
    validateMermaid(input.diagram)
    return ok({ valid: true, diagnostics: [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const d = extractParseDiagnostic(err, input.diagram)
    return ok({ valid: false, diagnostics: [d ?? { message }] })
  }
}
