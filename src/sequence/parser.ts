import type { SequenceDiagram, Message, Block, Actor } from './types.ts'
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
//   activate A / deactivate A   (standalone form of the +/- shorthand)
//   create participant C [as Label] / create actor C [as Label]
//                                 (on the line before C's first message)
//   destroy C                     (on the line before C's last message)
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

// Message-line arrow regexes, shared by the two-pass match in the "Message"
// branch of the parsing loop below (see the comment there for why there are
// two, and issue #341 for the mis-split bug this two-pass approach fixes).
// `MESSAGE_LONG_ARROW_RE` only recognizes the "long" arrow forms — anything
// ending in `>` (`->`, `-->`, `->>`, `-->>`) plus the bidirectional tokens
// (`<<->>`, `<<-->>`) — which essentially never occur by accident inside an
// unquoted actor name. `MESSAGE_ANY_ARROW_RE` is the original, full
// alternation (also matching the short open/cross forms `-)`, `--)`, `-x`,
// `--x`), used as a fallback when a line has no long arrow at all.
const MESSAGE_LONG_ARROW_RE =
  /^(.+?)\s*(<<->>|<<-->>|--?>?>)\s*([+-]?)(.+?)\s*:\s*(.+)$/
const MESSAGE_ANY_ARROW_RE =
  /^(.+?)\s*(<<->>|<<-->>|--?>?>|--?[)x]|--?>>|--?>)\s*([+-]?)(.+?)\s*:\s*(.+)$/

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
    activations: [],
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

  // `create participant X` / `destroy X` bind to the very next message —
  // Mermaid's sequenceDb enforces that the next message's recipient is the
  // created participant, and that the destroyed one is its sender or
  // recipient, throwing otherwise. Mirrored here (same error text) rather
  // than guessing which later message was meant. A directive with no
  // message after it at all is left as a plain declaration.
  let pendingCreate: string | undefined
  let pendingDestroy: string | undefined

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!

    // --- create participant / create actor ---
    // "create participant C" / "create actor C as Label" — the line before
    // C's first message. Same shape as a plain declaration, so the alias and
    // the participant/actor kind are kept, not dropped with the keyword.
    const createMatch = line.match(
      /^create\s+(participant|actor)\s+(\S+?)(?:\s+as\s+(.+))?$/,
    )
    if (createMatch) {
      const type: 'participant' | 'actor' =
        createMatch[1] === 'actor' ? 'actor' : 'participant'
      const id = createMatch[2]!
      if (actorIds.has(id)) {
        // Mermaid's own wording (sequenceDb `createParticipant`).
        throw new Error(
          "It is not possible to have actors with the same id, even if one is destroyed before the next is created. Use 'AS' aliases to simulate the behavior",
        )
      }
      actorIds.add(id)
      diagram.actors.push({
        id,
        label: normalizeBrTags(createMatch[3]?.trim() ?? id),
        type,
      })
      pendingCreate = id
      continue
    }

    // --- destroy ---
    // "destroy C" — the line before C's last message.
    const destroyMatch = line.match(/^destroy\s+(.+)$/)
    if (destroyMatch) {
      const id = destroyMatch[1]!.trim()
      ensureActor(diagram, actorIds, id)
      pendingDestroy = id
      continue
    }

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

    // --- Standalone activate / deactivate ---
    // "activate A" / "deactivate A". Mermaid's own grammar expands the `+`/`-`
    // arrow shorthand into exactly this (message, then an activeStart for the
    // recipient / activeEnd for the sender), so record the same event the
    // shorthand implies and let layout.ts feed both through one activation
    // stack. Checked before the message regex: neither keyword contains an
    // arrow token, but an actor literally named `activate` used as a message
    // *source* (`activate->>B: x`) still reaches the message branch, since
    // the `\s+` here requires whitespace after the keyword.
    const activationMatch = line.match(/^(activate|deactivate)\s+(.+)$/)
    if (activationMatch) {
      const actorId = activationMatch[2]!.trim()
      ensureActor(diagram, actorIds, actorId)
      diagram.activations.push({
        actorId,
        kind: activationMatch[1] === 'activate' ? 'start' : 'end',
        afterIndex: diagram.messages.length - 1,
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
    //
    // Two-pass match (issue #341): the lazy FROM capture stops as soon as
    // *any* position looks like a valid arrow+TO+`:`+LABEL tail, which is a
    // false positive when an unquoted actor name happens to contain a short
    // open/cross arrow substring (`-)`, `--)`, `-x`, `--x` — matched by the
    // `--?[)x]` alternative) ahead of the *real* arrow later in the line —
    // e.g. `foo-x-bar->>baz: hi` mis-split at the embedded `-x` instead of
    // the real `->>`. Those two-char forms are rare and highly ambiguous
    // inside a bare identifier, whereas the "long" forms (anything ending
    // in `>`, plus the bidirectional tokens) essentially never occur by
    // accident, since they require a literal `>` character in an unquoted
    // name. So: try the long forms only first, and only fall back to the
    // full alternation (including the short forms) if the line has no long
    // arrow at all — which is what keeps a genuinely short-arrow message
    // like `A-)B: msg` working. This doesn't attempt to disambiguate every
    // theoretically possible collision (e.g. a literal `->` substring
    // embedded before a real `->>`) — see the issue's own "Scope" section,
    // which limits the fix to the `-x`/`-)`/`--x`/`--)` substrings.
    const msgMatch =
      line.match(MESSAGE_LONG_ARROW_RE) ?? line.match(MESSAGE_ANY_ARROW_RE)
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
      const msgIndex = diagram.messages.length - 1
      const msg = diagram.messages[msgIndex]!
      if (pendingCreate !== undefined) {
        if (msg.to !== pendingCreate) {
          throw new Error(
            `The created participant ${pendingCreate} does not have an associated creating message after its declaration. Please check the sequence diagram.`,
          )
        }
        findActor(diagram, pendingCreate).createdAt = msgIndex
        pendingCreate = undefined
      }
      if (pendingDestroy !== undefined) {
        if (msg.from !== pendingDestroy && msg.to !== pendingDestroy) {
          throw new Error(
            `The destroyed participant ${pendingDestroy} does not have an associated destroying message after its declaration. Please check the sequence diagram.`,
          )
        }
        findActor(diagram, pendingDestroy).destroyedAt = msgIndex
        pendingDestroy = undefined
      }
      continue
    }
  }

  return diagram
}

/**
 * Look up an actor the parser itself already registered (every caller
 * passes an id that went through `ensureActor` or the create branch first,
 * so the miss branch is a parser-invariant violation, not user error).
 */
function findActor(diagram: SequenceDiagram, id: string): Actor {
  const actor = diagram.actors.find((a) => a.id === id)
  if (actor === undefined) {
    /* v8 ignore next */
    throw new Error(`Sequence diagram: unknown actor "${id}"`)
  }
  return actor
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
  // "x"/"--x" is Mermaid's "lost message" terminator — a cross, not a plain
  // filled arrowhead. `arrow.includes('x')` is unambiguous here: the only
  // arrow tokens containing "x" are "-x"/"--x" (see the message regex's
  // `--?[)x]` alternative above), never "->>"/"-->>" or the bidirectional
  // forms.
  const isLost = arrow.includes('x')

  const msg: Message = {
    from,
    to,
    label: normalizeBrTags(rawLabel.trim()),
    lineStyle,
    arrowHead,
  }
  if (isLost) msg.isLost = true
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
