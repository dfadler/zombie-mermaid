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
import { renderMermaidASCII } from '../ascii/index.ts'
import { findBoxRect, findTextRect } from './helpers/ascii-form.ts'

const LONG_LABEL = 'a rather long condition label that used to get clipped'
const VERY_LONG_LABEL =
  'an extremely long condition label that spans far more columns than any single lifeline gap would ever naturally provide'

function participants(names: string[]): string {
  return names.map((n) => `  participant ${n}`).join('\n')
}

// ---------------------------------------------------------------------------
// Block-wall-fits-label matrix (generalizes PR #387 / issue #352)
// ---------------------------------------------------------------------------

describe('ASCII sequence — block frame fits its own label (issue #352 family)', () => {
  // As of this writing, PR #387 (issue #352's fix) is open but not yet
  // merged: `main` still derives a block's wall purely from
  // `minLX`/`maxLX` (src/ascii/sequence.ts:603-623), with no reference to
  // the header/divider label's own width, and hard-clips the label text at
  // `bRight` while drawing it (:639-640). Running this matrix against
  // current `main` shows the gap is not limited to `alt`/`else` (PR #387's
  // title/scope) or to one specific label length — every block type
  // truncates any label wider than the message-driven span. Short labels
  // that already fit are live regression locks; everything wider is
  // `it.fails`, documenting the gap PR #387 will need to close generically
  // (all five block types) rather than only for its own alt/else repro.
  const shortLabelCases: Array<{
    name: string
    type: 'alt' | 'loop' | 'opt' | 'par' | 'critical'
    actors: string[]
  }> = [
    { name: 'alt, short label, 2 actors', type: 'alt', actors: ['A', 'B'] },
    { name: 'loop, short label, 2 actors', type: 'loop', actors: ['A', 'B'] },
    { name: 'opt, short label, 3 actors', type: 'opt', actors: ['A', 'B', 'C'] },
    { name: 'par, short label, 3 actors', type: 'par', actors: ['A', 'B', 'C'] },
    { name: 'critical, short label, 2 actors', type: 'critical', actors: ['A', 'B'] },
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
    { name: 'alt, long label, 2 actors', type: 'alt', label: LONG_LABEL, actors: ['A', 'B'] },
    {
      name: 'alt, very long label, 2 actors',
      type: 'alt',
      label: VERY_LONG_LABEL,
      actors: ['A', 'B'],
    },
    { name: 'alt, long label, 5 actors', type: 'alt', label: LONG_LABEL, actors: ['A', 'B', 'C', 'D', 'E'] },
    { name: 'loop, long label, 2 actors', type: 'loop', label: LONG_LABEL, actors: ['A', 'B'] },
    { name: 'opt, long label, 3 actors', type: 'opt', label: LONG_LABEL, actors: ['A', 'B', 'C'] },
    { name: 'par, long label, 3 actors', type: 'par', label: LONG_LABEL, actors: ['A', 'B', 'C'] },
    {
      name: 'critical, very long label, 2 actors',
      type: 'critical',
      label: VERY_LONG_LABEL,
      actors: ['A', 'B'],
    },
  ]

  for (const c of longLabelCases) {
    it.fails(c.name, () => {
      const src = `sequenceDiagram
${participants(c.actors)}
  ${c.type} ${c.label}
    ${c.actors[0]}->>${c.actors[1]}: x
  end`
      const ascii = renderMermaidASCII(src, { useAscii: true })
      expect(ascii).toContain(c.label)
    })
  }

  it.fails('alt/else with multiple branches: every divider label survives unclipped', () => {
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
  it.fails(
    // Bug: src/ascii/sequence.ts:199-214 — `nx = llX[aIdx] - nWidth - 1`
    // clamped to `Math.max(0, nx)`. For the leftmost actor, a note wider
    // than its (small) left margin clamps to column 0, so the note's own
    // rectangle swallows its own actor's lifeline column instead of sitting
    // entirely to its left.
    'note left of the leftmost actor does not overlap that actor\'s own lifeline',
    () => {
      const src = `sequenceDiagram
  participant A as Alice
  participant B as Bob
  Note left of A: ${LONG_LABEL}
  A->>B: hi`
      const ascii = renderMermaidASCII(src, { useAscii: true })
      const noteRect = findTextRect(ascii, LONG_LABEL)
      const aliceCol = lifelineColumn(ascii, 'Alice')
      expect(aliceCol < noteRect.x0 || aliceCol > noteRect.x1).toBe(true)
    },
  )

  it.fails(
    // Bug: same clamp as above, but the victim is a *different* actor's
    // lifeline — the exact shape visible in samples-data.ts's "Sequence:
    // Notes (Right/Left/Over)" sample ("Alice prepares" reaching into Bob's
    // lifeline). A non-leftmost actor with a real left neighbor and a note
    // wide enough that `llX[aIdx] - nWidth - 1 < 0`.
    'note left of a non-leftmost actor does not overlap the left-neighbor\'s lifeline',
    () => {
      const src = `sequenceDiagram
  participant A as Alice
  participant B as Bob
  participant C as Carol
  Note left of B: ${LONG_LABEL}
  B->>C: hi`
      const ascii = renderMermaidASCII(src, { useAscii: true })
      const noteRect = findTextRect(ascii, LONG_LABEL)
      const aliceCol = lifelineColumn(ascii, 'Alice')
      expect(aliceCol < noteRect.x0 || aliceCol > noteRect.x1).toBe(true)
    },
  )

  it.fails(
    // Bug: the lifeline gap (sequence.ts:114-131) is sized only from
    // message-label widths — note width never enters that calculation for
    // either side. Notes draw last (after lifelines/boxes/messages/blocks),
    // so a right-note wider than the gap to the *next* actor silently
    // overwrites that actor's lifeline. No `Math.max(0, …)` clamp involved
    // — a genuinely different bug from the two above, sharing only the
    // visible symptom.
    'note right of an actor does not overlap the next actor\'s lifeline',
    () => {
      const src = `sequenceDiagram
  participant A as Alice
  participant B as Bob
  participant C as Carol
  A->>B: hi
  Note right of B: ${LONG_LABEL}`
      const ascii = renderMermaidASCII(src, { useAscii: true })
      const noteRect = findTextRect(ascii, LONG_LABEL)
      const carolCol = lifelineColumn(ascii, 'Carol')
      expect(carolCol < noteRect.x0 || carolCol > noteRect.x1).toBe(true)
    },
  )

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
    const noteRect = findTextRect(ascii, 'hi')
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
    const noteRect = findTextRect(ascii, 'ok')
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
    const noteRect = findTextRect(ascii, 'conversation complete')
    const carolCol = lifelineColumn(ascii, 'Carol')
    expect(carolCol < noteRect.x0 || carolCol > noteRect.x1).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Actor-kind fidelity: `actor` must render distinctly from `participant`
// ---------------------------------------------------------------------------

describe('ASCII sequence — `actor` renders distinctly from `participant`', () => {
  // Bug: `actor.type` (captured by the parser — see src/sequence/types.ts:24,
  // "'actor' renders as a stick figure") is never read anywhere in
  // src/ascii/sequence.ts. Every actor draws through the same box-drawing
  // path regardless of declared type, so an `actor` and a `participant`
  // with the same label render byte-for-byte identically today.
  it.fails.each([
    ['first', 'U'],
    ['middle', 'U'],
    ['last', 'U'],
  ])('an %s-position `actor` looks different from a `participant` (%s)', (_position, id) => {
    const asActor = renderMermaidASCII(
      `sequenceDiagram
  actor ${id} as User
  participant S as System
  ${id}->>S: hi`,
      { useAscii: true },
    )
    const asParticipant = renderMermaidASCII(
      `sequenceDiagram
  participant ${id} as User
  participant S as System
  ${id}->>S: hi`,
      { useAscii: true },
    )
    expect(asActor).not.toBe(asParticipant)
  })
})
