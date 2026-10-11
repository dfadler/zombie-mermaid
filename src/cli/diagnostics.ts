// CLI-side line-level diagnostics: reuse the MCP helper that lifts a parser's
// "Line N: ..." prefix, and append the offending source line (#1691).
import { extractParseDiagnostic } from '../../packages/mcp/src/tools/parse-diagnostics.ts'

/** Return `err` with the offending source line appended when one is known. */
export function withSourceLine(err: unknown, text: string): unknown {
  if (!(err instanceof Error)) return err
  const d = extractParseDiagnostic(err.message, text)
  if (d === undefined) return err
  return new Error(`${err.message}\n  ${d.line} | ${d.sourceLine}`)
}
