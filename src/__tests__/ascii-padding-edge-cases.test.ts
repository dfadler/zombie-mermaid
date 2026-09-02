// ============================================================================
// ASCII padding edge-case tests (issue #343 — CodeRabbit follow-up)
//
// #343 made paddingX/paddingY/boxBorderPadding functional for sequence,
// class, and ER diagrams. CodeRabbit's review of that PR found three ways
// an out-of-range padding value could corrupt output rather than just
// tighten/loosen spacing:
//
//   1. A negative boxBorderPadding could make measureMultiBox/drawMultiBox
//      compute a negative box width for a short label (class/ER boxes, and
//      sequence actor/note boxes, which derive their own width the same way).
//   2. A very small paddingX/paddingY on an ER diagram could shrink hGap/vGap
//      below what a 2-cell crow's-foot marker needs, making same-row markers
//      overlap or vertical markers land on the same row.
//   3. A very small paddingY on a sequence diagram could collapse rowGap to
//      0, so a block divider and the following message (or a block's closing
//      border and the footer) would land on the same row and overwrite each
//      other, rather than just rendering tightly.
//
// This file locks in the fixes for all three.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('ASCII padding edge cases (issue #343 follow-up)', () => {
  it('a negative boxBorderPadding does not produce a negative-width class box', () => {
    const cls = `classDiagram
      class Foo`
    // Should not throw, and every border run should still be a real box
    // (at least 3 chars: two corners + at least one border char).
    const ascii = renderMermaidASCII(cls, {
      useAscii: true,
      boxBorderPadding: -10,
    })
    const borderRuns = ascii.match(/\+-+\+/g) ?? []
    expect(borderRuns.length).toBeGreaterThan(0)
    for (const run of borderRuns) expect(run.length).toBeGreaterThanOrEqual(3)
    expect(ascii).toContain('Foo')
  })

  it('a negative boxBorderPadding does not produce a negative-width ER box', () => {
    const er = `erDiagram
      CUSTOMER {
        string name
      }`
    const ascii = renderMermaidASCII(er, {
      useAscii: true,
      boxBorderPadding: -10,
    })
    const borderRuns = ascii.match(/\+-+\+/g) ?? []
    expect(borderRuns.length).toBeGreaterThan(0)
    for (const run of borderRuns) expect(run.length).toBeGreaterThanOrEqual(3)
    expect(ascii).toContain('CUSTOMER')
  })

  it('a negative boxBorderPadding does not produce a negative-width sequence actor box', () => {
    const seq = `sequenceDiagram
      participant A
      participant B
      A->>B: Hi`
    const ascii = renderMermaidASCII(seq, {
      useAscii: true,
      boxBorderPadding: -10,
    })
    const borderRuns = ascii.match(/\+-+\+/g) ?? []
    expect(borderRuns.length).toBeGreaterThan(0)
    for (const run of borderRuns) expect(run.length).toBeGreaterThanOrEqual(3)
    expect(ascii).toContain('A')
    expect(ascii).toContain('B')
  })

  it("a very negative paddingX keeps ER crow's-foot markers from overlapping", () => {
    // Both endpoint markers ('|' for "one", '<' + 'o' for "zero-many") must
    // still appear as distinct, non-overwriting characters in the connector
    // segment between the two entity boxes. Extract that segment precisely
    // (the text between "CUSTOMER |" and "| ORDER") rather than slicing from
    // the line's first/last '|' — the "one" marker is itself a '|', so a
    // naive first/last-pipe slice would silently include it as a false
    // positive even when it has been overwritten by the other marker.
    const er = `erDiagram
      CUSTOMER ||--o{ ORDER : x`
    const ascii = renderMermaidASCII(er, { useAscii: true, paddingX: -100 })
    const line = ascii.split('\n').find((l) => l.includes('CUSTOMER'))
    expect(line).toBeDefined()
    const match = /CUSTOMER\s*\|(.*)\|\s*ORDER/.exec(line!)
    expect(match).not.toBeNull()
    const connector = match![1]!
    expect(connector).toContain('|')
    expect(connector).toContain('o')
    expect(connector).toContain('<')
  })

  it('a very negative paddingY keeps ER vertical relationship markers on separate rows', () => {
    // A wraps to a second row relative to C (via B forcing a 2-column grid),
    // producing a vertical connector whose upper/lower crow's-foot markers
    // must land on different rows even when vGap is squeezed.
    const er = `erDiagram
      A ||--o{ B : r1
      A ||--o{ C : r2`
    const ascii = renderMermaidASCII(er, { useAscii: true, paddingY: -100 })
    const lines = ascii.split('\n')
    // Find the two marker rows for the A-C vertical relationship: one
    // containing the label "r2" (upper marker) and, below it, one
    // containing the zero-many marker glyphs.
    const r2Idx = lines.findIndex((l) => l.includes('r2'))
    expect(r2Idx).toBeGreaterThanOrEqual(0)
    const markerIdx = lines.findIndex(
      (l, i) => i > r2Idx && /[o<]/.test(l) && !l.includes('CUSTOMER'),
    )
    expect(markerIdx).toBeGreaterThan(r2Idx)
  })

  it('very tight paddingY keeps a block divider from overwriting the next message', () => {
    const seq = `sequenceDiagram
      participant A
      participant B
      alt yes
        A->>B: One
      else no
        A->>B: Two
      end`
    const ascii = renderMermaidASCII(seq, { useAscii: true, paddingY: -100 })
    // Both branch labels must survive — a collision would silently drop
    // "Two" by overwriting its row with the divider row.
    expect(ascii).toContain('One')
    expect(ascii).toContain('Two')
    expect(ascii).toContain('[no]')
  })

  it('very tight paddingY keeps a block-closing border from overwriting the footer', () => {
    const seq = `sequenceDiagram
      participant A
      participant B
      alt yes
        A->>B: One
      end`
    const ascii = renderMermaidASCII(seq, { useAscii: true, paddingY: -100 })
    const lines = ascii.split('\n')
    // The two-actor header and footer boxes each draw a "+---+   +---+"-
    // style top border and an identical-looking bottom border — 4 such rows
    // total. A collision between the block's closing border and the
    // footer's top border overwrites the footer's top border entirely
    // (verified by sabotaging the fix: the count drops to 3, and the
    // footer's content row — "| A |     | B |" — appears directly under the
    // block's closing border with no border row above it), rather than
    // merely rendering close together, so counting these rows is a precise
    // way to detect it instead of checking for adjacency.
    const twoBoxBorderRows = lines.filter((l) =>
      /^\s*\+-+\+\s+\+-+\+\s*$/.test(l),
    )
    expect(twoBoxBorderRows.length).toBe(4)
  })
})
