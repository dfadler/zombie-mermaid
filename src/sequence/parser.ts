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
//   A<<->>B: Bidirectional solid arrow
//   A<<-->>B: Bidirectional dashed arrow
//   autonumber / autonumber <start> <step> / autonumber off
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

  // `autonumber` state — a bare `autonumber` turns numbering on starting at 1
  // (step 1); `autonumber <start> <step>` sets both explicitly; `autonumber
  // off` turns it back off. Only messages consume a number — notes and
  // block/divider lines don't advance the counter.
  const autonumber = { enabled: false, next: 1, step: 1 }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!

    // --- autonumber directive ---
    const autonumberMatch = line.match(
      /^autonumber(?:\s+(off|\d+(?:\.\d{1,2})?)(?:\s+(\d+(?:\.\d{1,2})?))?)?$/,
    )
    if (autonumberMatch) {
      const start = autonumberMatch[1]
      const step = autonumberMatch[2]
      if (start === 'off') {
        autonumber.enabled = false
      } else {
        autonumber.enabled = true
        autonumber.next = start !== undefined ? Number(start) : 1
        autonumber.step = step !== undefined ? Number(step) : 1
      }
      continue
    }

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
    // Patterns: A->>B, A-->>B, A-)B, A--)B, A<<->>B, A<<-->>B, with optional
    // +/- activation. Format: FROM ARROW TO: LABEL
    //
    // FROM/TO are matched with a lazy `.+?` (not `\S+?`) so an undeclared
    // actor name can contain spaces or internal hyphens — e.g. `cron
    // job->>customer-notifier: hi` — mirroring real Mermaid's own sequence
    // grammar, whose unquoted ACTOR token excludes only the characters that
    // start an arrow/label (`/ \ + ( ) < - > :`) rather than all whitespace.
    // Because the quantifier is lazy and anchored by the arrow/colon tokens
    // that follow, this still resolves to the same minimal split as before
    // for plain single-word names.
    const msgMatch = line.match(
      /^(.+?)\s*(<<->>|<<-->>|--?>?>|--?[)x]|--?>>|--?>)\s*([+-]?)(.+?)\s*:\s*(.+)$/,
    )
    if (msgMatch) {
      pushMessage(
        diagram,
        actorIds,
        autonumber,
        msgMatch[1]!,
        msgMatch[2]!,
        msgMatch[3],
        msgMatch[4]!,
        msgMatch[5]!,
      )
      continue
    }

    // --- Simplified message format: A->>B: Label (fallback with more relaxed regex) ---
    const simpleMsgMatch = line.match(
      /^(.+?)\s*(<<->>|<<-->>|->>|-->>|-\)|--\)|-x|--x|->|-->)\s*([+-]?)(.+?)\s*:\s*(.+)$/,
    )
    if (simpleMsgMatch) {
      pushMessage(
        diagram,
        actorIds,
        autonumber,
        simpleMsgMatch[1]!,
        simpleMsgMatch[2]!,
        simpleMsgMatch[3],
        simpleMsgMatch[4]!,
        simpleMsgMatch[5]!,
      )
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

/**
 * Build a `Message` from a matched arrow-message line and push it onto the
 * diagram. Shared by both message regexes in `parseSequenceDiagram` above so
 * the arrow → line-style/arrow-head/bidirectional mapping and `autonumber`
 * bookkeeping can't drift out of sync between them.
 */
function pushMessage(
  diagram: SequenceDiagram,
  actorIds: Set<string>,
  autonumber: { enabled: boolean; next: number; step: number },
  from: string,
  arrow: string,
  activationMark: string | undefined,
  to: string,
  rawLabel: string,
): void {
  ensureActor(diagram, actorIds, from)
  ensureActor(diagram, actorIds, to)

  const bidirectional = arrow === '<<->>' || arrow === '<<-->>'
  const lineStyle = bidirectional
    ? arrow === '<<-->>'
      ? 'dashed'
      : 'solid'
    : arrow.startsWith('--')
      ? 'dashed'
      : 'solid'
  // ">>" = filled arrow, ")" or ">" alone = open arrow, "x" = cross (treat as
  // filled). Both bidirectional tokens end in ">>", so they fall out as filled.
  const arrowHead =
    arrow.includes('>>') || arrow.includes('x') ? 'filled' : 'open'

  const msg: Message = {
    from,
    to,
    label: normalizeBrTags(rawLabel.trim()),
    lineStyle,
    arrowHead,
  }
  if (bidirectional) msg.bidirectional = true
  if (activationMark === '+') msg.activate = true
  if (activationMark === '-') msg.deactivate = true

  if (autonumber.enabled) {
    msg.seqNumber = autonumber.next
    autonumber.next =
      Math.round((autonumber.next + autonumber.step) * 100) / 100
  }

  diagram.messages.push(msg)
}
