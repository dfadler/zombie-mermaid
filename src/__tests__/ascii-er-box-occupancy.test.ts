// ============================================================================
// ASCII ER diagram box-occupancy invariants
//
// Generalizes issue #350's fix (src/ascii/er-diagram.ts's `setCGuarded`/
// `boxCells`/`regionClear` occupancy guard — see
// ascii-er-relationship-label-corruption-350.test.ts for the original fixed
// repro) from a single fixed repro into a swept matrix: no two entity boxes
// ever overlap, and no relationship label ever lands inside an entity box it
// isn't attached to. svg-samples.visual.test.ts / ascii-samples.visual.test.ts
// only self-diff against a committed baseline screenshot, so they can't catch
// this shape of regression on their own — these assertions check the
// renderer's own occupancy guarantee directly, on any diagram shape, not just
// the one screenshot on file.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'
import { findBoxRect, findTextRect, rectsOverlap } from './helpers/ascii-form.ts'

/** Assert no two named entity boxes in `ascii` overlap. */
function expectNoBoxOverlap(ascii: string, names: string[]): void {
  const rects = names.map((n) => ({ n, r: findBoxRect(ascii, n) }))
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      expect(
        rectsOverlap(rects[i]!.r, rects[j]!.r),
        `${rects[i]!.n} and ${rects[j]!.n} boxes overlap`,
      ).toBe(false)
    }
  }
}

/** Assert `label` doesn't land inside any of `names`' boxes. */
function expectLabelOutsideBoxes(
  ascii: string,
  label: string,
  names: string[],
): void {
  const labelRect = findTextRect(ascii, label)
  for (const name of names) {
    const boxRect = findBoxRect(ascii, name)
    expect(
      rectsOverlap(labelRect, boxRect),
      `label "${label}" lands inside ${name}'s box`,
    ).toBe(false)
  }
}

describe('ASCII ER diagrams — entity boxes never overlap (issue #350 family)', () => {
  it('2 entities, 1 direct relationship, short label', () => {
    const src = `erDiagram
  A ||--o{ B : owns`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['A', 'B'])
  })

  it('2 entities, direct, long label', () => {
    const src = `erDiagram
  A ||--o{ B : ships_to_a_regional_warehouse`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['A', 'B'])
  })

  it('2 entities, direct, long identifier names', () => {
    const src = `erDiagram
  CUSTOMER_ACCOUNT_PROFILE ||--o{ SHIPPING_ADDRESS_RECORD : has`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['CUSTOMER_ACCOUNT_PROFILE', 'SHIPPING_ADDRESS_RECORD'])
  })

  it('3 entities, adjacent-only chain (smoke case)', () => {
    const src = `erDiagram
  A ||--o{ B : one
  B ||--o{ C : two`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['A', 'B', 'C'])
  })

  it('3 entities same row, A-C skipping B (direct issue #350 shape)', () => {
    const src = `erDiagram
  A ||--o{ B : one
  A ||--o| C : skips_b`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['A', 'B', 'C'])
    expectLabelOutsideBoxes(ascii, 'skips_b', ['B'])
  })

  it('3 entities, A-C skip B, long multi-word label', () => {
    const src = `erDiagram
  A ||--o{ B : one
  A ||--o| C : a_very_long_descriptive_relationship_name`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['A', 'B', 'C'])
    expectLabelOutsideBoxes(ascii, 'a_very_long_descriptive_relationship_name', ['B'])
  })

  it('3 entities, A-C skip B, long names', () => {
    const src = `erDiagram
  ALPHA_ENTITY ||--o{ BRAVO_ENTITY : one
  ALPHA_ENTITY ||--o| CHARLIE_ENTITY : skips_b`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['ALPHA_ENTITY', 'BRAVO_ENTITY', 'CHARLIE_ENTITY'])
  })

  it('5 entities, 3-per-row layout, A-C skip B in row 1', () => {
    const src = `erDiagram
  A ||--o{ B : one
  A ||--o| C : skips_b
  A ||--o{ D : two
  A ||--o{ E : three`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['A', 'B', 'C', 'D', 'E'])
  })

  it('5 entities, two same-row obstructed pairs sharing the row-gap band', () => {
    const src = `erDiagram
  A ||--o{ B : one
  A ||--o| C : first_skip
  D ||--o{ E : two
  A ||--o{ D : bridge
  D ||--o| B : second_skip`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['A', 'B', 'C', 'D', 'E'])
    const firstSkip = findTextRect(ascii, 'first_skip')
    const secondSkip = findTextRect(ascii, 'second_skip')
    expect(
      rectsOverlap(firstSkip, secondSkip),
      'first_skip and second_skip labels overlap each other',
    ).toBe(false)
  })

  it('5 entities, vertical relationship whose row-mate is taller', () => {
    const src = `erDiagram
  A ||--o{ B : one
  A {
    string id
    string a1
    string a2
    string a3
    string a4
    string a5
  }
  C ||--o{ D : two
  A ||--o| D : cross_row`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['A', 'B', 'C', 'D'])
  })

  it('7 entities, multi-row skip spanning 3 rows', () => {
    const src = `erDiagram
  A ||--o{ B : r1a
  A ||--o{ C : r1b
  D ||--o{ E : r2a
  D ||--o{ F : r2b
  G ||--o{ A : r3
  G ||--o| D : long_skip_across_rows`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['A', 'B', 'C', 'D', 'E', 'F', 'G'])
  })

  it('4 entities, mixed same-row + cross-row + diagonal relationship', () => {
    const src = `erDiagram
  A ||--o{ B : same_row
  C ||--o{ D : same_row_2
  A ||--o| D : diagonal`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['A', 'B', 'C', 'D'])
  })

  it('2 entities, parallel relationships (2 labels, same pair)', () => {
    const src = `erDiagram
  A ||--o{ B : places_order
  A ||--o{ B : returns_item`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    const label1 = findTextRect(ascii, 'places_order')
    const label2 = findTextRect(ascii, 'returns_item')
    expect(rectsOverlap(label1, label2), 'the two relationship labels overlap').toBe(false)
  })

  it('3 entities, two-char crow\'s-foot markers, minimal gap', () => {
    const src = `erDiagram
  A }o--o{ B : m2m
  B }o--o{ C : m2m2`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['A', 'B', 'C'])
  })

  it('6 entities, 2 disconnected components, each with same-row obstruction', () => {
    const src = `erDiagram
  A ||--o{ B : one
  A ||--o| C : skip_1

  D ||--o{ E : two
  D ||--o| F : skip_2`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['A', 'B', 'C', 'D', 'E', 'F'])
  })

  it('3 entities, A-C skip B, B has zero attributes (short box)', () => {
    const src = `erDiagram
  A ||--o{ B : one
  A ||--o| C : skip_short_b`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['A', 'B', 'C'])
  })

  it('3 entities, A-C skip B, B has 8 attributes (tall box)', () => {
    const src = `erDiagram
  A ||--o{ B : one
  B {
    string id
    string b1
    string b2
    string b3
    string b4
    string b5
    string b6
    string b7
  }
  A ||--o| C : skip_tall_b`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['A', 'B', 'C'])
  })

  it('4 entities in one row, A-D skipping 2 (B and C)', () => {
    const src = `erDiagram
  A ||--o{ B : one
  B ||--o{ C : two
  A ||--o| D : skip_two`
    const ascii = renderMermaidASCII(src, { useAscii: true })
    expectNoBoxOverlap(ascii, ['A', 'B', 'C', 'D'])
  })
})
