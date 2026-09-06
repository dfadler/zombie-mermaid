// ============================================================================
// Sequence diagram — activation/deactivation balance check
//
// A mechanical, deterministic semantic check: every `activate X` (or the
// `+` arrow shorthand) must be closed by a matching `deactivate X` (or the
// `-` shorthand) before the diagram ends. This doesn't need an LLM judge —
// it's the same activation-stack bookkeeping src/sequence/layout.ts already
// runs to *draw* activation bars (see its `activationStacks` map), reused
// here to *report* imbalance instead of silently rendering around it.
//
// Motivation (issue #539, split from #536): research on LLM-generated
// Mermaid sequence diagrams found they fail mostly on activation handling
// and error/status tracking, not basic syntax — which existing validators
// (syntax checkers, and agentic-mermaid's structural/geometric/lint
// `verify` tool: dangling edges, label overflow, duplicate/unreachable
// nodes) already cover well. Activation balance is a concrete, narrow,
// mechanically-checkable instance of that gap.
// ============================================================================

import type { SequenceDiagram, Message } from './types.ts'

export type ActivationIssueCode =
  | 'DANGLING_ACTIVATION'
  | 'UNMATCHED_DEACTIVATION'

export interface ActivationIssue {
  code: ActivationIssueCode
  /** Actor whose activation is unbalanced. */
  actorId: string
  /** Human-readable explanation, including a source-position hint. */
  message: string
}

export interface ActivationCheckResult {
  /** true when every activation is balanced (no issues found). */
  ok: boolean
  issues: ActivationIssue[]
}

/** One `activate`/`deactivate` event in source order, whichever form wrote it. */
interface Event {
  actorId: string
  kind: 'start' | 'end'
  afterIndex: number
}

/**
 * Describe where an event occurred, for a human-readable issue message.
 * Mirrors the `afterIndex` semantics of `SequenceDiagram.activations` (see
 * types.ts): -1 means "before the first message", otherwise the index of
 * the message this event follows.
 */
function describePosition(
  diagram: SequenceDiagram,
  afterIndex: number,
): string {
  if (afterIndex < 0) return 'before the first message'
  const msg: Message | undefined = diagram.messages[afterIndex]
  if (!msg) return 'at an unresolved position'
  const label = msg.label ? `: ${msg.label}` : ''
  return `after message ${afterIndex + 1} ("${msg.from} -> ${msg.to}${label}")`
}

/**
 * Check a parsed sequence diagram for activation/deactivation imbalance.
 *
 * Merges the inline `+`/`-` arrow shorthand (`Message.activate` /
 * `Message.deactivate`) with standalone `activate X` / `deactivate X`
 * statements (`SequenceDiagram.activations`) into one chronological event
 * stream per actor — the same merge `layout.ts` performs to position
 * activation bars — then walks a stack per actor:
 *
 * - A `deactivate` with nothing open on that actor's stack is reported as
 *   `UNMATCHED_DEACTIVATION` (the renderer silently ignores this case —
 *   see `endActivation` in layout.ts — this check surfaces it instead).
 * - Anything left on a stack once every message has been processed is
 *   reported as `DANGLING_ACTIVATION` (the renderer draws these extending
 *   to the bottom of the diagram, which usually isn't what the author
 *   intended).
 */
export function checkActivationBalance(
  diagram: SequenceDiagram,
): ActivationCheckResult {
  // Standalone activations, grouped by the message index they follow — same
  // grouping layout.ts builds for its `activationEventsByAfterIndex`.
  const standaloneByAfterIndex = new Map<number, typeof diagram.activations>()
  for (const event of diagram.activations) {
    const list = standaloneByAfterIndex.get(event.afterIndex) ?? []
    list.push(event)
    standaloneByAfterIndex.set(event.afterIndex, list)
  }

  const events: Event[] = []
  function pushStandalone(afterIndex: number): void {
    for (const event of standaloneByAfterIndex.get(afterIndex) ?? []) {
      events.push({ actorId: event.actorId, kind: event.kind, afterIndex })
    }
  }

  // Events before the first message open first, same as layout.ts.
  pushStandalone(-1)
  for (let i = 0; i < diagram.messages.length; i++) {
    const msg = diagram.messages[i]!
    if (msg.activate) {
      events.push({ actorId: msg.to, kind: 'start', afterIndex: i })
    }
    if (msg.deactivate) {
      events.push({ actorId: msg.from, kind: 'end', afterIndex: i })
    }
    pushStandalone(i)
  }

  // actorId -> stack of afterIndex values where an activation was opened.
  const stacks = new Map<string, number[]>()
  const issues: ActivationIssue[] = []

  for (const event of events) {
    const stack = stacks.get(event.actorId) ?? []
    stacks.set(event.actorId, stack)
    if (event.kind === 'start') {
      stack.push(event.afterIndex)
      continue
    }
    const openedAt = stack.pop()
    if (openedAt === undefined) {
      issues.push({
        code: 'UNMATCHED_DEACTIVATION',
        actorId: event.actorId,
        message:
          `"deactivate ${event.actorId}" ${describePosition(diagram, event.afterIndex)} ` +
          `has no matching "activate ${event.actorId}" open at that point.`,
      })
    }
  }

  for (const [actorId, stack] of stacks) {
    for (const openedAt of stack) {
      issues.push({
        code: 'DANGLING_ACTIVATION',
        actorId,
        message:
          `"activate ${actorId}" opened ${describePosition(diagram, openedAt)} ` +
          `is never closed with a matching "deactivate ${actorId}".`,
      })
    }
  }

  return { ok: issues.length === 0, issues }
}
