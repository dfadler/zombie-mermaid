// ============================================================================
// Sequence diagram — activation/deactivation auto-fix
//
// Extends activation-check.ts (issue #539) with the "optionally proposes a
// fix" half of that issue's scope. Deliberately narrow: only
// `DANGLING_ACTIVATION` (an `activate X` never closed) is auto-fixable —
// the mechanical, unambiguous repair is to append a matching `deactivate X`
// after the diagram's last statement, which is always syntactically valid
// regardless of block nesting (Mermaid's `deactivate` isn't block-scoped).
//
// `UNMATCHED_DEACTIVATION` (a `deactivate X` with nothing open) is
// deliberately NOT auto-fixed: fixing it means either deleting that
// specific statement or inserting a preceding `activate X`, and this
// package doesn't track source line/position per activation statement (see
// SequenceDiagram.activations — only a message-index `afterIndex`, no raw
// line offset), so a text-level edit could not target the right occurrence
// with confidence when the same statement text repeats. Rather than guess
// and risk mangling unrelated source, this case is reported back as a
// remaining (unfixable) issue for a human — or a fuzzier LLM-based layer,
// per the issue's own caveat about unvalidated frontier-model behavior — to
// resolve.
// ============================================================================

import { detectDiagramType, splitStatements } from '@zombie-mermaid/core'
import { parseSequenceDiagram } from './parser.ts'
import { checkActivationBalance, type ActivationIssue } from './activation-check.ts'

export interface ActivationFixResult {
  /** true when the returned diagram has no remaining activation issues. */
  ok: boolean
  /** Original diagram, unchanged if there was nothing fixable. */
  originalDiagram: string
  /**
   * Diagram with a "deactivate X" statement appended for every
   * DANGLING_ACTIVATION issue found. Identical to `originalDiagram` when
   * there was nothing to fix.
   */
  fixedDiagram: string
  /** Human-readable description of each fix actually applied. */
  fixesApplied: string[]
  /**
   * Issues that could not be auto-fixed (currently always
   * UNMATCHED_DEACTIVATION — see module header). Empty when `ok` is true.
   */
  remainingIssues: ActivationIssue[]
}

/**
 * Check a Mermaid sequence diagram for activation/deactivation imbalance
 * and, where mechanically safe, return a corrected version.
 *
 * Throws the same way `parseSequenceDiagram`/`detectDiagramType` do on
 * invalid or non-sequence input — callers (e.g. the MCP tool handler) are
 * expected to catch and translate, matching `check-sequence-activations.ts`'s
 * own error handling.
 */
export function fixActivationBalance(sourceDiagram: string): ActivationFixResult {
  const diagramType = detectDiagramType(sourceDiagram)
  if (diagramType !== 'sequence') {
    throw new Error(
      'fixActivationBalance only supports sequence diagrams (source must ' +
        `start with "sequenceDiagram"); detected diagram type: "${diagramType}".`,
    )
  }

  const lines = splitStatements(sourceDiagram)
  const diagram = parseSequenceDiagram(lines)
  const result = checkActivationBalance(diagram)

  if (result.ok) {
    return {
      ok: true,
      originalDiagram: sourceDiagram,
      fixedDiagram: sourceDiagram,
      fixesApplied: [],
      remainingIssues: [],
    }
  }

  const dangling = result.issues.filter(
    (issue) => issue.code === 'DANGLING_ACTIVATION',
  )
  const remainingIssues = result.issues.filter(
    (issue) => issue.code !== 'DANGLING_ACTIVATION',
  )

  const appended = dangling
    .map((issue) => `  deactivate ${issue.actorId}`)
    .join('\n')
  const fixedDiagram =
    dangling.length === 0
      ? sourceDiagram
      : `${sourceDiagram.replace(/\s+$/, '')}\n${appended}`

  const fixesApplied = dangling.map(
    (issue) =>
      `Appended "deactivate ${issue.actorId}" to close: ${issue.message}`,
  )

  return {
    ok: remainingIssues.length === 0,
    originalDiagram: sourceDiagram,
    fixedDiagram,
    fixesApplied,
    remainingIssues,
  }
}
