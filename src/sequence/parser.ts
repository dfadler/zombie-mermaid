import type { SequenceDiagram, Message, Block } from './types.ts'
import { normalizeBrTags } from '../multiline-utils.ts'

/**
 * Narrow a regex-captured block keyword to `Block['type']`. The capturing
 * regex at the call site uses the same `(loop|alt|opt|par|critical|break|
 * rect)` alternation, so the input is always one of these seven values in
 * practice — but the match itself is typed as `string`.
 *
 * Exported for direct unit testing (see
 * src/__tests__/sequence-parser.test.ts) — not otherwise part of this
 * module's public parsing API.
 */
export function isBlockType(value: string): value is Block['type'] {
  return (
    value === 'loop' ||
    value === 'alt' ||
    value === 'opt' ||
    value === 'par' ||
    value === 'critical' ||
    value === 'break' ||
    value === 'rect'
  )
}

/**
 * Narrow a regex-captured block keyword to `Block['type']`, throwing if it
 * somehow isn't one of the seven recognized keywords (see `isBlockType`
 * above — unreachable via the guarding regex in practice, but this keeps
 * the failure explicit rather than silently mistyping the value).
 *
 * Exported for direct unit testing (see
 * src/__tests__/sequence-parser.test.ts) — the throw branch is unreachable
 * through the public `parseSequenceDiagram` API (the regex that captures
 * the value already restricts it to the seven valid keywords), so it can
 * only be exercised by calling this function directly.
 */
export function toBlockType(value: string): Block['type'] {
  if (!isBlockType(value)) {
    throw new Error(`Invalid block type: "${value}"`)
  }
  return value
}

// ============================================================================
// Sequence diagram parser
//
// Parses Mermaid sequenceDiagram syntax into a SequenceDiagram structure.
//
// Supported syntax:
//   participant A as Alice
//   actor B as Bob
//   A->>B: Solid arrow
//   A-->>B: Dashed arrow
//   A-)B: Open arrow
//   A--)B: Dashed open arrow
//   A->>+B: Activate target
//   A-->>-B: Deactivate source
//   loop Label ... end
//   alt Label ... else Label ... end
//   opt Label ... end
//   par Label ... and Label ... end
//   Note left of A: Text
//   Note right of A: Text
//   Note over A,B: Text
// ============================================================================

/**
 * Parse a Mermaid sequence diagram.
 * Expects the first line to be "sequenceDiagram".
 */
// Audited for issue #100 (non-null assertions): every `!` in this file is
// one of three idioms already accepted as justified elsewhere in this
// codebase — (1) a bounds-checked loop-index array access (`lines[i]!`
// inside a `for (let i = 1; i < lines.length; ...)` loop), (2) a
// regex-mandatory-capture-group access after `.match()` (a group not
// wrapped in an optional `(?:...)?`, so it always participates when the
// overall match succeeds), or (3) `blockStack[blockStack.length - 1]!` /
// `blockStack.pop()!`, both guarded immediately above by an explicit
// `blockStack.length > 0` check. See src/parser.ts (PR #158) and this
// subsystem's layout.ts audit (PR #149), which fixed the one genuinely
// risky assertion in the subsystem (a Map get/set race) but didn't reach
// this file — PR #146 separately reviewed this file's `as` casts, a
// different concern from these `!`s. `noUncheckedIndexedAccess` can't see
// any of these guarantees, but removing the `!` would only replace a
// proven-safe assertion with an unreachable guard. Left as-is; no
// behavior change.
export function parseSequenceDiagram(lines: string[]): SequenceDiagram {
  const diagram: SequenceDiagram = {
    actors: [],
    messages: [],
    blocks: [],
    notes: [],
  }

  // Track actor IDs to auto-create actors referenced in messages
  const actorIds = new Set<string>()
  // Track block nesting with a stack
  const blockStack: Array<{
    type: Block['type']
    label: string
    startIndex: number
    dividers: Block['dividers']
  }> = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!

    // --- Participant / Actor declaration ---
    // "participant A as Alice" or "participant Alice"
    // "actor B as Bob" or "actor Bob"
    const actorMatch = line.match(
      /^(participant|actor)\s+(\S+?)(?:\s+as\s+(.+))?$/,
    )
    if (actorMatch) {
      // Group 1 is constrained by the regex alternation to 'participant' | 'actor'
      const type: 'participant' | 'actor' =
        actorMatch[1] === 'actor' ? 'actor' : 'participant'
      const id = actorMatch[2]!
      const rawLabel = actorMatch[3]?.trim() ?? id
      const label = normalizeBrTags(rawLabel)
      if (!actorIds.has(id)) {
        actorIds.add(id)
        diagram.actors.push({ id, label, type })
      }
      continue
    }

    // --- Note ---
    // "Note left of A: text" / "Note right of A: text" / "Note over A,B: text"
    const noteMatch = line.match(
      /^Note\s+(left of|right of|over)\s+([^:]+):\s*(.+)$/i,
    )
    if (noteMatch) {
      const posStr = noteMatch[1]!.toLowerCase()
      const actorsStr = noteMatch[2]!.trim()
      const text = normalizeBrTags(noteMatch[3]!.trim())
      const noteActorIds = actorsStr.split(',').map((s) => s.trim())

      // Ensure actors exist
      for (const aid of noteActorIds) {
        ensureActor(diagram, actorIds, aid)
      }

      let position: 'left' | 'right' | 'over' = 'over'
      if (posStr === 'left of') position = 'left'
      else if (posStr === 'right of') position = 'right'

      diagram.notes.push({
        actorIds: noteActorIds,
        text,
        position,
        afterIndex: diagram.messages.length - 1,
      })
      continue
    }

    // --- Block start: loop, alt, opt, par, critical, break, rect ---
    const blockMatch = line.match(
      /^(loop|alt|opt|par|critical|break|rect)\s*(.*)$/,
    )
    if (blockMatch) {
      const blockType = toBlockType(blockMatch[1]!)
      const rawBlockLabel = blockMatch[2]?.trim() ?? ''
      const label = normalizeBrTags(rawBlockLabel)
      blockStack.push({
        type: blockType,
        label,
        startIndex: diagram.messages.length,
        dividers: [],
      })
      continue
    }

    // --- Block divider: else, and ---
    const dividerMatch = line.match(/^(else|and)\s*(.*)$/)
    if (dividerMatch && blockStack.length > 0) {
      const rawDividerLabel = dividerMatch[2]?.trim() ?? ''
      const label = normalizeBrTags(rawDividerLabel)
      blockStack[blockStack.length - 1]!.dividers.push({
        index: diagram.messages.length,
        label,
      })
      continue
    }

    // --- Block end ---
    if (line === 'end' && blockStack.length > 0) {
      const completed = blockStack.pop()!
      diagram.blocks.push({
        type: completed.type,
        label: completed.label,
        startIndex: completed.startIndex,
        endIndex: Math.max(diagram.messages.length - 1, completed.startIndex),
        dividers: completed.dividers,
      })
      continue
    }

    // --- Message ---
    // Patterns: A->>B, A-->>B, A-)B, A--)B, with optional +/- activation
    // Format: FROM ARROW TO: LABEL
    const msgMatch = line.match(
      /^(\S+?)\s*(--?>?>|--?[)x]|--?>>|--?>)\s*([+-]?)(\S+?)\s*:\s*(.+)$/,
    )
    if (msgMatch) {
      const from = msgMatch[1]!
      const arrow = msgMatch[2]!
      const activationMark = msgMatch[3]
      const to = msgMatch[4]!
      const label = normalizeBrTags(msgMatch[5]!.trim())

      // Ensure both actors exist
      ensureActor(diagram, actorIds, from)
      ensureActor(diagram, actorIds, to)

      // Determine line style and arrow head from the arrow operator
      const lineStyle = arrow.startsWith('--') ? 'dashed' : 'solid'
      // ">>" = filled arrow, ")" or ">" alone = open arrow, "x" = cross (treat as filled)
      const arrowHead =
        arrow.includes('>>') || arrow.includes('x') ? 'filled' : 'open'

      const msg: Message = {
        from,
        to,
        label,
        lineStyle,
        arrowHead,
      }

      // Activation/deactivation via +/- prefix on target
      if (activationMark === '+') msg.activate = true
      if (activationMark === '-') msg.deactivate = true

      diagram.messages.push(msg)
      continue
    }

    // --- Simplified message format: A->>B: Label (fallback with more relaxed regex) ---
    const simpleMsgMatch = line.match(
      /^(\S+?)\s*(->>|-->>|-\)|--\)|-x|--x|->|-->)\s*([+-]?)(\S+?)\s*:\s*(.+)$/,
    )
    if (simpleMsgMatch) {
      const from = simpleMsgMatch[1]!
      const arrow = simpleMsgMatch[2]!
      const activationMark = simpleMsgMatch[3]
      const to = simpleMsgMatch[4]!
      const label = normalizeBrTags(simpleMsgMatch[5]!.trim())

      ensureActor(diagram, actorIds, from)
      ensureActor(diagram, actorIds, to)

      const lineStyle = arrow.startsWith('--') ? 'dashed' : 'solid'
      const arrowHead =
        arrow.includes('>>') || arrow.includes('x') ? 'filled' : 'open'

      const msg: Message = { from, to, label, lineStyle, arrowHead }
      if (activationMark === '+') msg.activate = true
      if (activationMark === '-') msg.deactivate = true

      diagram.messages.push(msg)
      continue
    }

    // --- activate / deactivate explicit commands ---
    // These are handled implicitly via +/- on messages but can also appear standalone
    // For now, we skip explicit activate/deactivate lines (they affect rendering only)
  }

  return diagram
}

/** Ensure an actor exists, creating a default participant if not */
function ensureActor(
  diagram: SequenceDiagram,
  actorIds: Set<string>,
  id: string,
): void {
  if (!actorIds.has(id)) {
    actorIds.add(id)
    diagram.actors.push({ id, label: id, type: 'participant' })
  }
}
