// ============================================================================
// ASCII sequence diagram structural "form" invariants
//
// svg-samples.visual.test.ts / ascii-samples.visual.test.ts only self-diff
// against a committed baseline screenshot — a defect present when that
// baseline was captured passes forever. This file asserts structural
// properties the renderer should hold regardless of any specific fixture:
// a block's frame must fit its own label (generalizes PR #387's fix beyond
// its single fixed repro), a note must not visually collide with a lifeline
// it isn't attached to, and an `actor` participant must render distinctly
// from a plain `participant` box.
//
// Cases that assert already-correct, already-fixed behavior are plain
// `it()`s — regression locks. Cases that assert behavior confirmed broken
// today use `it.fails(...)`: the assertion body is real and genuinely
// exercises the bug, so it fails loudly (in the good direction, since
// `it.fails` inverts pass/fail) the moment someone fixes it elsewhere —
// signaling that case should be promoted to a plain `it()`. These bugs are
// intentionally not fixed in this change; fixing them is separate work.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { findBoxRect, findTextRect } from './helpers/ascii-form.ts'

const LONG_LABEL = 'a rather long condition label that used to get clipped'
const VERY_LONG_LABEL =
  'an extremely long condition label that spans far more columns than any single lifeline gap would ever naturally provide'

function participants(names: string[]): string {
  return names.map((n) => `  participant ${n}`).join('\n')
}

const BORDER_ASCII = new Set(['+', '-', '|'])

/**
 * A block's left/right wall columns, found via the row containing
 * `anchorText` (e.g. the block type keyword, which — unlike a header/divider
 * label — is never itself truncated, so it's a stable anchor even when the
 * label content next to it is clipped). The walls are constant across the
 * whole block (header, every divider, and the body all share the same two
 * wall columns), so one anchor row is enough regardless of which row a
 * later containment check is against.
 */
function blockFrameSpan(
  ascii: string,
  anchorText: string,
): { x0: number; x1: number } {
  const lines = ascii.split('\n')
  const y = lines.findIndex((l) => l.includes(anchorText))
  if (y === -1)
    throw new Error(`blockFrameSpan: no row containing "${anchorText}"`)
  const line = lines[y]!
  let x0 = line.length
  let x1 = -1
  for (let x = 0; x < line.length; x++) {
    if (BORDER_ASCII.has(line[x]!)) {
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
    }
  }
  if (x1 === -1) throw new Error(`blockFrameSpan: no border chars on row ${y}`)
  return { x0, x1 }
}

// ---------------------------------------------------------------------------
// Block-wall-fits-label matrix (generalizes PR #387 / issue #352)
// ---------------------------------------------------------------------------

describe('ASCII sequence — block frame fits its own label (issue #352 family)', () => {
  // PR #387 (issue #352's fix) closes this gap generically — for every
  // block type, not just its own alt/else repro — by measuring the
  // longest header/divider label up front and widening the wall (see
  // `maxBlockLabelWidth` in src/ascii/sequence.ts) rather than deriving it
  // purely from `minLX`/`maxLX`. The long-label matrix below was written
  // as `it.fails` against pre-#387 `main`, documenting that the gap wasn't
  // limited to `alt`/`else` or to one label length; now that the fix has
  // landed, every case is a plain `it()` regression lock, same as the
  // short-label cases above.
  const shortLabelCases: Array<{
    name: string
    type: 'alt' | 'loop' | 'opt' | 'par' | 'critical'
    actors: string[]
  }> = [
    { name: 'alt, short label, 2 actors', type: 'alt', actors: ['A', 'B'] },
    { name: 'loop, short label, 2 actors', type: 'loop', actors: ['A', 'B'] },
    {
      name: 'opt, short label, 3 actors',
      type: 'opt',
      actors: ['A', 'B', 'C'],
    },
    {
      name: 'par, short label, 3 actors',
      type: 'par',
      actors: ['A', 'B', 'C'],
    },
    {
      name: 'critical, short label, 2 actors',
      type: 'critical',
      actors: ['A', 'B'],
    },
  ]

  for (const c of shortLabelCases) {
    it(c.name, () => {
      const src = `sequenceDiagram
${participants(c.actors)}
  ${c.type} ok
    ${c.actors[0]}->>${c.actors[1]}: x
  end`
      const ascii = renderMermaidASCII(src, { useAscii: true })
      expect(ascii).toContain('ok')
    })
  }

  const longLabelCases: Array<{
    name: string
    type: 'alt' | 'loop' | 'opt' | 'par' | 'critical'
    label: string
    actors: string[]
  }> = [
    {
      name: 'alt, long label, 2 actors',
      type: 'alt',
      label: LONG_LABEL,
      actors: ['A', 'B'],
    },
    {
      name: 'alt, very long label, 2 actors',
      type: 'alt',
      label: VERY_LONG_LABEL,
      actors: ['A', 'B'],
    },
    {
      name: 'alt, long label, 5 actors',
      type: 'alt',
      label: LONG_LABEL,
      actors: ['A', 'B', 'C', 'D', 'E'],
    },
    {
      name: 'loop, long label, 2 actors',
      type: 'loop',
      label: LONG_LABEL,
      actors: ['A', 'B'],
    },
    {
      name: 'opt, long label, 3 actors',
      type: 'opt',
      label: LONG_LABEL,
      actors: ['A', 'B', 'C'],
    },
    {
      name: 'par, long label, 3 actors',
      type: 'par',
      label: LONG_LABEL,
      actors: ['A', 'B', 'C'],
    },
    {
      name: 'critical, very long label, 2 actors',
      type: 'critical',
      label: VERY_LONG_LABEL,
      actors: ['A', 'B'],
    },
  ]

  for (const c of longLabelCases) {
    it(c.name, () => {
      const src = `sequenceDiagram
${participants(c.actors)}
  ${c.type} ${c.label}
    ${c.actors[0]}->>${c.actors[1]}: x
  end`
      const ascii = renderMermaidASCII(src, { useAscii: true })
      // Not just "does the full label appear somewhere" — it must also sit
      // inside the block's own walls, not spill past them.
      expect(ascii).toContain(c.label)
      const frame = blockFrameSpan(ascii, c.type)
      const labelRect = findTextRect(ascii, c.label)
      expect(labelRect.x0).toBeGreaterThanOrEqual(frame.x0)
      expect(labelRect.x1).toBeLessThanOrEqual(frame.x1)
    })
  }

  it('alt/else with multiple branches: every divider label survives unclipped and stays inside the frame', () => {
    const src = `sequenceDiagram
  participant A
  participant B
  alt ${LONG_LABEL}
    A->>B: x
  else ${VERY_LONG_LABEL}
    A->>B: y
  end`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expect(ascii).toContain(LONG_LABEL)
    expect(ascii).toContain(VERY_LONG_LABEL)
    // Walls are constant across the whole block, so the header row alone
    // (anchored on "alt", never itself truncated) gives the frame span
    // both labels — header and divider — must stay inside.
    const frame = blockFrameSpan(ascii, 'alt')
    for (const label of [LONG_LABEL, VERY_LONG_LABEL]) {
      const rect = findTextRect(ascii, label)
      expect(rect.x0).toBeGreaterThanOrEqual(frame.x0)
      expect(rect.x1).toBeLessThanOrEqual(frame.x1)
    }
  })
})

// ---------------------------------------------------------------------------
// Note cross-contamination matrix
// ---------------------------------------------------------------------------

/** Column of an actor's lifeline: the horizontal midpoint of its header box. */
function lifelineColumn(ascii: string, actorName: string): number {
  const rect = findBoxRect(ascii, actorName)
  return Math.round((rect.x0 + rect.x1) / 2)
}

describe('ASCII sequence — notes do not collide with an unrelated lifeline', () => {
  // Fixed by issue #953 case A: `sequence.ts`'s note-x calculation
  // (`nx = llX[aIdx] - nWidth - 1`) used to clamp straight to
  // `Math.max(0, nx)`, so a note wider than the leftmost actor's (small)
  // left margin clamped to column 0 and swallowed its own actor's lifeline
  // column instead of sitting entirely to its left. The fix reserves room
  // in the leftmost lifeline's own initial position (`llX[0]`) for its
  // widest `left` note up front, so `nx` never needs clamping in the first
  // place. Per this file's header convention, a case confirmed fixed is
  // promoted from `it.fails` to a plain `it()` regression lock.
  it("note left of the leftmost actor does not overlap that actor's own lifeline", () => {
    const src = `sequenceDiagram
  participant A as Alice
  participant B as Bob
  Note left of A: ${LONG_LABEL}
  A->>B: hi`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    // findBoxRect, not findTextRect — the note's own border/padding must
    // also stay clear of the lifeline, not just its bare text span.
    const noteRect = findBoxRect(ascii, LONG_LABEL)
    const aliceCol = lifelineColumn(ascii, 'Alice')
    expect(aliceCol < noteRect.x0 || aliceCol > noteRect.x1).toBe(true)
  })

  // Fixed by issue #953 case B: same clamp as above, but the victim is a
  // *different* actor's lifeline — the exact shape visible in
  // samples-data.ts's "Sequence: Notes (Right/Left/Over)" sample ("Alice
  // prepares" reaching into Bob's lifeline). The fix reserves a
  // note-width-aware gap between adjacent lifelines (see `leftNoteWidth`/
  // `rightNoteWidth` in sequence.ts), so a `left` note's own gap is sized to
  // fit it before `nx` is ever computed.
  it("note left of a non-leftmost actor does not overlap the left-neighbor's lifeline", () => {
    const src = `sequenceDiagram
  participant A as Alice
  participant B as Bob
  participant C as Carol
  Note left of B: ${LONG_LABEL}
  B->>C: hi`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    const noteRect = findBoxRect(ascii, LONG_LABEL)
    const aliceCol = lifelineColumn(ascii, 'Alice')
    expect(aliceCol < noteRect.x0 || aliceCol > noteRect.x1).toBe(true)
  })

  // Fixed by issue #953 case C: the lifeline gap used to be sized only from
  // message-label widths — note width never entered that calculation for
  // either side. Notes draw last (after lifelines/boxes/messages/blocks),
  // so a right-note wider than the gap to the *next* actor silently
  // overwrote that actor's lifeline. No `Math.max(0, …)` clamp was involved
  // — a genuinely different bug from the two above, sharing only the
  // visible symptom. The fix folds note width into the same gap-sizing pass
  // that already accounts for message labels.
  it("note right of an actor does not overlap the next actor's lifeline", () => {
    const src = `sequenceDiagram
  participant A as Alice
  participant B as Bob
  participant C as Carol
  A->>B: hi
  Note right of B: ${LONG_LABEL}`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    const noteRect = findBoxRect(ascii, LONG_LABEL)
    const carolCol = lifelineColumn(ascii, 'Carol')
    expect(carolCol < noteRect.x0 || carolCol > noteRect.x1).toBe(true)
  })

  // Fixed by issue #992: a single-actor `Note over` centers on that actor's
  // own lifeline (`nx = llX[aIdx] - Math.floor(nWidth / 2)`), but neither
  // half of that width was reserved during layout — so a note wider than
  // the actor's own column spilled into whichever neighbor was closer,
  // exactly the shape cases A-C above already fixed for `left`/`right`
  // notes. This is the exact repro from the issue (two actors, a note over
  // the first one). A *multi*-actor `Note over A,B` is unaffected —
  // spanning both actors is its intended shape (see the "note over two
  // actors" case below), not this bug.
  it("single-actor 'over' note on the first actor does not overlap the next actor's lifeline (issue #992 repro)", () => {
    const src = `sequenceDiagram
  participant A as Alice
  participant B as Bob
  Note over A: ${LONG_LABEL}
  A->>B: hi`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    const noteRect = findBoxRect(ascii, LONG_LABEL)
    const bobCol = lifelineColumn(ascii, 'Bob')
    expect(bobCol < noteRect.x0 || bobCol > noteRect.x1).toBe(true)
  })

  // Same fix, but a middle actor: both halves of the note (left half toward
  // Alice, right half toward Carol) need to be reserved, not just the
  // leftmost-actor case above.
  it("single-actor 'over' note on a middle actor does not overlap either neighbor's lifeline", () => {
    const src = `sequenceDiagram
  participant A as Alice
  participant B as Bob
  participant C as Carol
  A->>B: hi
  Note over B: ${LONG_LABEL}`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    const noteRect = findBoxRect(ascii, LONG_LABEL)
    const aliceCol = lifelineColumn(ascii, 'Alice')
    const carolCol = lifelineColumn(ascii, 'Carol')
    expect(aliceCol < noteRect.x0 || aliceCol > noteRect.x1).toBe(true)
    expect(carolCol < noteRect.x0 || carolCol > noteRect.x1).toBe(true)
  })

  it("short single-actor 'over' note does not overlap the next actor", () => {
    const src = `sequenceDiagram
  participant A as Alice
  participant B as Bob
  Note over A: ok
  A->>B: hi`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    const noteRect = findBoxRect(ascii, 'ok')
    const bobCol = lifelineColumn(ascii, 'Bob')
    expect(bobCol < noteRect.x0 || bobCol > noteRect.x1).toBe(true)
  })

  // Regression locks: short notes, which don't hit any of the three bugs
  // above, must keep rendering without collision.
  it('short note left of a middle actor does not overlap its left neighbor', () => {
    const src = `sequenceDiagram
  participant A as Alice
  participant B as Bob
  participant C as Carol
  Note left of B: hi
  B->>C: hi`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    const noteRect = findBoxRect(ascii, 'hi')
    const aliceCol = lifelineColumn(ascii, 'Alice')
    expect(aliceCol < noteRect.x0 || aliceCol > noteRect.x1).toBe(true)
  })

  it('short note right of an actor does not overlap the next actor', () => {
    const src = `sequenceDiagram
  participant A as Alice
  participant B as Bob
  participant C as Carol
  A->>B: hi
  Note right of B: ok`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    const noteRect = findBoxRect(ascii, 'ok')
    const carolCol = lifelineColumn(ascii, 'Carol')
    expect(carolCol < noteRect.x0 || carolCol > noteRect.x1).toBe(true)
  })

  it('note over two actors does not overlap a third, uninvolved actor', () => {
    const src = `sequenceDiagram
  participant A as Alice
  participant B as Bob
  participant C as Carol
  A->>B: hi
  Note over A,B: conversation complete`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    const noteRect = findBoxRect(ascii, 'conversation complete')
    const carolCol = lifelineColumn(ascii, 'Carol')
    expect(carolCol < noteRect.x0 || carolCol > noteRect.x1).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Actor-kind fidelity: `actor` must render distinctly from `participant`
// ---------------------------------------------------------------------------

type ActorPosition = 'first' | 'middle' | 'last'

/**
 * Declares `id` (as either `actor` or `participant`) at `position` among two
 * other fixed participants — first/middle/last are only meaningful with at
 * least one neighbor on the relevant side, so this always yields 3 declared
 * actors, not just `id` alone.
 */
function declareActorAt(
  position: ActorPosition,
  kind: 'actor' | 'participant',
  id: string,
): string {
  const target = `${kind} ${id} as User`
  const lines =
    position === 'first'
      ? [target, 'participant S as System', 'participant DB as Database']
      : position === 'last'
        ? ['participant S as System', 'participant DB as Database', target]
        : ['participant S as System', target, 'participant DB as Database']
  return lines.map((l) => `  ${l}`).join('\n')
}

describe('ASCII sequence — `actor` renders distinctly from `participant`', () => {
  // Fixed by issue #449: `src/ascii/sequence.ts`'s `drawActorBox` now draws
  // a small stick-figure glyph (`ACTOR_GLYPH_LINES`) above the label for
  // `actor.type === 'actor'`, so an `actor` and a `participant` with the
  // same label no longer render byte-for-byte identically. Per this file's
  // header convention, a case confirmed fixed is promoted from `it.fails`
  // to a plain `it()` regression lock.
  it.each<[ActorPosition, string]>([
    ['first', 'U'],
    ['middle', 'U'],
    ['last', 'U'],
  ])(
    'an %s-position `actor` looks different from a `participant` (%s)',
    (position, id) => {
      const asActor = renderMermaidASCII(
        `sequenceDiagram
${declareActorAt(position, 'actor', id)}
  ${id}->>S: hi`,
        { useAscii: true },
      )
      const asParticipant = renderMermaidASCII(
        `sequenceDiagram
${declareActorAt(position, 'participant', id)}
  ${id}->>S: hi`,
        { useAscii: true },
      )
      expect(asActor).not.toBe(asParticipant)
    },
  )
})
