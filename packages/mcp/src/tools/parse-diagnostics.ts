// ============================================================================
// zombie-mermaid MCP server — parse diagnostics for failed renders
//
// Every parser throw is a MermaidParseError (#1979), whose `line` is the
// 1-based physical line of the caller's source. This module lifts that into
// a structured diagnostic (line + the offending source line) so an agent can
// fix the one bad line instead of resubmitting the whole diagram blind.
//
// Nothing here alters, strips, or partially renders the diagram — it only
// describes the error. Only the pie parser reports a column, so `column` is
// not emitted here. Errors with no line (or whose line is outside the
// submitted source) get no diagnostic and fall back to the plain message.
// ============================================================================

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { MermaidParseError } from '@zombie-mermaid/core'

export interface ParseDiagnostic {
  /** 1-based physical line in the submitted diagram source. */
  line: number
  /** The offending source line, verbatim (not trimmed). */
  sourceLine: string
  /** The parser's message with the "Line N: " prefix removed. */
  message: string
}

const LINE_PREFIX = /^Line (\d+): ([\s\S]*)$/

/**
 * Extract a diagnostic from a parser error, or `undefined` when it is not a
 * `MermaidParseError` with a usable line for `diagram`.
 */
export function extractParseDiagnostic(
  err: unknown,
  diagram: string,
): ParseDiagnostic | undefined {
  if (!(err instanceof MermaidParseError) || err.line === undefined) {
    return undefined
  }
  const { line, message } = err
  const match = LINE_PREFIX.exec(message)
  const sourceLine = diagram.split(/\r?\n/)[line - 1]
  if (line < 1 || sourceLine === undefined) return undefined
  return { line, sourceLine, message: match?.[2] ?? message }
}

/**
 * Build the MCP error result for a failed render. The first content block is
 * the unchanged `<prefix>: <message>` text existing callers rely on; when a
 * line can be identified, a second text block carries
 * `{"diagnostics":[{line,sourceLine,message}]}` as JSON.
 */
export function renderErrorResult(
  prefix: string,
  err: unknown,
  diagram: string,
): CallToolResult {
  const message = err instanceof Error ? err.message : String(err)
  const content: CallToolResult['content'] = [
    { type: 'text', text: `${prefix}: ${message}` },
  ]
  const diagnostic = extractParseDiagnostic(err, diagram)
  if (diagnostic !== undefined) {
    content.push({
      type: 'text',
      text: JSON.stringify({ diagnostics: [diagnostic] }),
    })
  }
  return { isError: true, content }
}
