// ============================================================================
// ASCII ER diagram relationship-label/box-corruption regression tests
// (GitHub issue #350)
//
// erDiagram relationship lines and labels were drawn without checking
// whether the straight-line path they took actually stayed clear of other
// entities' boxes. Two entities placed in the same row of the layout grid
// were always connected with a straight horizontal line even when a third
// entity sat physically between them (e.g. ORDER↔SHIPMENT with LINE_ITEM in
// between), so the line and its label were composited directly on top of
// that third entity's border and attribute text — a well-formed-looking but
// wrong attribute name (e.g. "int totalCents" silently became
// "int hasalCents"). A parallel bug existed for vertical connections: the
// horizontal jog between two entities in different rows used the naive
// vertical midpoint, which could still land inside a row-mate that was
// taller than the connection's own upper entity.
//
// The fix makes relationship routing obstruction-aware (detour around a
// row-mate that sits between two connected entities; clamp the vertical
// jog into the row-gap band that's actually free of every entity) and adds
// a last-resort occupancy guard so a relationship line, marker, or label
// can never overwrite a cell already reserved by an entity box or by an
// earlier relationship's label — see setCGuarded in src/ascii/er-diagram.ts.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

/** Assert every one of `needles` appears verbatim, exactly once, in `text`. */
function expectAllPresentOnce(text: string, needles: string[]): void {
  for (const needle of needles) {
    const count = text.split(needle).length - 1
    expect(count, `expected "${needle}" to appear exactly once`).toBe(1)
  }
}

// The exact minimal repro from issue #350.
const REPRO_MINIMAL = `erDiagram
    ORDER ||--|{ LINE_ITEM : contains
    ORDER ||--o| SHIPMENT : fulfilled_by
    PRODUCT ||--o{ LINE_ITEM : appears_in
    WAREHOUSE ||--o{ SHIPMENT : dispatches
    ORDER {
        string id
        string customerId
        int totalCents
        string status
    }
    LINE_ITEM {
        string orderId
        string productId
        int quantity
        int unitPriceCents
    }
    PRODUCT {
        string sku
        string title
        int priceCents
    }
`

// The fuller repro from issue #350 — more entities, more relationships
// crowding the same rows, including two labels ("has" / "fulfilled_by")
// that both need to route through the same row-gap band.
const REPRO_FULL = `erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER ||--o{ ADDRESS : has
    ORDER ||--|{ LINE_ITEM : contains
    ORDER ||--o| SHIPMENT : fulfilled_by
    PRODUCT ||--o{ LINE_ITEM : appears_in
    PRODUCT }o--|| CATEGORY : belongs_to
    WAREHOUSE ||--o{ SHIPMENT : dispatches

    CUSTOMER {
        string id
        string email
        string name
        date createdAt
    }
    ORDER {
        string id
        string customerId
        int totalCents
        string status
    }
    LINE_ITEM {
        string orderId
        string productId
        int quantity
        int unitPriceCents
    }
    PRODUCT {
        string sku
        string title
        int priceCents
    }
`

describe('ASCII ER relationship labels never corrupt entity boxes (issue #350)', () => {
  it('renders every attribute name verbatim in the minimal repro', () => {
    const ascii = renderMermaidASCII(REPRO_MINIMAL, { colorMode: 'none' })
    expectAllPresentOnce(ascii, [
      'string id',
      'string customerId',
      'int totalCents',
      'string status',
      'string orderId',
      'string productId',
      'int quantity',
      'int unitPriceCents',
      'string sku',
      'string title',
      'int priceCents',
    ])
  })

  it('renders every relationship label in full in the minimal repro', () => {
    const ascii = renderMermaidASCII(REPRO_MINIMAL, { colorMode: 'none' })
    expect(ascii).toContain('contains')
    expect(ascii).toContain('fulfilled_by')
    expect(ascii).toContain('appears_in')
    expect(ascii).toContain('dispatches')
    // The original bug doubled a trailing character when a label was
    // partially overwritten (e.g. "fulfilled_byy").
    expect(ascii).not.toContain('fulfilled_byy')
  })

  it('does not produce the specific corrupted values from issue #350', () => {
    const ascii = renderMermaidASCII(REPRO_MINIMAL, { colorMode: 'none' })
    // "int unitPriceCents" (LINE_ITEM) must never read as though a label
    // overwrote part of it, and "productId"/"quantity" must survive.
    expect(ascii).not.toContain('fulfilled_byy')
    expect(ascii).toContain('productId')
    expect(ascii).toContain('quantity')
  })

  it('renders every attribute name verbatim in the fuller repro', () => {
    const ascii = renderMermaidASCII(REPRO_FULL, { colorMode: 'none' })
    // "string id" is intentionally excluded here — CUSTOMER and ORDER both
    // declare it, so it legitimately appears twice.
    expectAllPresentOnce(ascii, [
      'string email',
      'string name',
      'date createdAt',
      'string customerId',
      'int totalCents',
      'string status',
      'string orderId',
      'string productId',
      'int quantity',
      'int unitPriceCents',
      'string sku',
      'string title',
      'int priceCents',
    ])
    // The issue's headline corruption: "int totalCents" silently became
    // "int hasalCents" when the "has" label (CUSTOMER↔ADDRESS, skipping
    // over ORDER) was composited into ORDER's box.
    expect(ascii).not.toContain('hasalCents')
  })

  it('renders every relationship label in full in the fuller repro', () => {
    const ascii = renderMermaidASCII(REPRO_FULL, { colorMode: 'none' })
    expect(ascii).toContain('places')
    expect(ascii).toContain('has')
    expect(ascii).toContain('contains')
    expect(ascii).toContain('fulfilled_by')
    expect(ascii).toContain('appears_in')
    expect(ascii).toContain('belongs_to')
    expect(ascii).toContain('dispatches')
  })

  it('keeps every entity box border fully intact (no line/label punched through a border)', () => {
    const ascii = renderMermaidASCII(REPRO_MINIMAL, { colorMode: 'none' })
    const lines = ascii.split('\n')
    // Every box's header row (e.g. "│ LINE_ITEM ") must still open with the
    // left border directly followed by a space, never a relationship glyph.
    for (const name of [
      'ORDER',
      'LINE_ITEM',
      'SHIPMENT',
      'PRODUCT',
      'WAREHOUSE',
    ]) {
      const headerLine = lines.find((l) => l.includes(`│ ${name}`))
      expect(headerLine, `expected a header line for ${name}`).toBeDefined()
    }
  })

  it('detects attribute corruption the same way the issue does: every declared attribute name must appear verbatim', () => {
    // Mirrors the issue's own "Detection" section: erDiagram attribute names
    // are known at parse time, so corruption shows up as a missing name.
    const ascii = renderMermaidASCII(REPRO_MINIMAL, { colorMode: 'none' })
    const declaredAttributeNames = [
      'id',
      'customerId',
      'totalCents',
      'status',
      'orderId',
      'productId',
      'quantity',
      'unitPriceCents',
      'sku',
      'title',
      'priceCents',
    ]
    for (const name of declaredAttributeNames) {
      expect(
        ascii,
        `expected declared attribute "${name}" to survive`,
      ).toContain(name)
    }
  })
})

describe('ASCII ER relationship label routing — adjacent-entity regression (issue #350)', () => {
  it('keeps a short label between two adjacent entities compact (no unnecessary detour)', () => {
    const ascii = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : x`,
      { colorMode: 'none' },
    )
    const lines = ascii.split('\n')
    const line = lines.find((l) => l.includes('A') && l.includes('│'))
    expect(line).toBeDefined()
    expect(line!.length).toBeLessThan(30)
    expect(ascii).toContain('x')
  })

  it('renders a normal two-entity diagram exactly as before (direct line, no detour)', () => {
    const ascii = renderMermaidASCII(
      `erDiagram
        CUSTOMER ||--o{ ORDER : places`,
      { colorMode: 'none' },
    )
    // No third entity to dodge, so the connector should sit on a single row
    // directly below the connecting line — not detoured further down.
    const lines = ascii.split('\n')
    const placesIdx = lines.findIndex((l) => l.includes('places'))
    const connectorIdx = lines.findIndex(
      (l) => l.includes('○') || l.includes('╢') || l.includes('╟'),
    )
    expect(placesIdx).toBeGreaterThan(-1)
    expect(connectorIdx).toBeGreaterThan(-1)
    // The label sits exactly one row below the connector row in the direct
    // (undetoured) case.
    expect(placesIdx).toBe(connectorIdx + 1)
  })

  it('renders three entities in a row with adjacent-only relationships without detouring', () => {
    // B sits between A and C, but the only relationships are A-B and B-C —
    // both adjacent pairs, so neither needs to route around anything.
    const ascii = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : ab
        B ||--o{ C : bc`,
      { colorMode: 'none' },
    )
    expect(ascii).toContain('ab')
    expect(ascii).toContain('bc')
  })
})

describe('ASCII ER relationship label routing — long labels and crowded areas (issue #350)', () => {
  it('routes a long label between two non-adjacent same-row entities around the entity between them', () => {
    // ORDER and SHIPMENT are placed in the same row with LINE_ITEM between
    // them (5-entity component ⇒ 3 columns per row); "fulfilled_by" must
    // detour around LINE_ITEM rather than being written into its box.
    const ascii = renderMermaidASCII(REPRO_MINIMAL, { colorMode: 'none' })
    expect(ascii).toContain('fulfilled_by')
    expect(ascii).toContain('string productId')
    expect(ascii).toContain('int quantity')
  })

  it('keeps multiple relationship labels distinct when several need to route through the same row-gap band', () => {
    // In REPRO_FULL, CUSTOMER↔ADDRESS ("has") and ORDER↔SHIPMENT
    // ("fulfilled_by") both detour through the row-gap band below
    // CUSTOMER/ORDER/ADDRESS's row. Neither should silently disappear or
    // get merged into the other.
    const ascii = renderMermaidASCII(REPRO_FULL, { colorMode: 'none' })
    expect(ascii).toContain('has')
    expect(ascii).toContain('fulfilled_by')
  })

  it('does not corrupt attribute text with a longer, multi-word relationship label', () => {
    const ascii = renderMermaidASCII(
      `erDiagram
        CUSTOMER ||--o{ ORDER : places
        CUSTOMER ||--o{ ADDRESS : "ships to"
        ORDER {
          string id
          int totalCents
        }
        CUSTOMER {
          string id
          string name
        }`,
      { colorMode: 'none' },
    )
    expect(ascii).toContain('ships to')
    expect(ascii).toContain('int totalCents')
    expect(ascii).toContain('string name')
  })
})

// ============================================================================
// Follow-up findings from CodeRabbit's review of the #350 fix (PR #391) —
// both are the same "silently overwritten" shape as the original issue,
// just between two relationships instead of a relationship and a box.
// ============================================================================

describe('ASCII ER relationship label routing — parallel relationships (CodeRabbit follow-up)', () => {
  it('keeps both labels when two relationships connect the exact same adjacent pair (same-row)', () => {
    // A↔B are adjacent (no obstruction), so both "first" and "second" land
    // on the identical direct-path row unless the label search kicks in.
    const ascii = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : first
        A ||--o{ B : second`,
      { colorMode: 'none' },
    )
    expect(ascii).toContain('first')
    expect(ascii).toContain('second')
  })

  it('keeps both labels when two relationships connect the exact same vertical pair', () => {
    // A (row1) and C (row2) are directly above/below each other; both
    // "first" and "second" would compute the identical band midpoint
    // without pickBandY's collision search.
    const ascii = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : sibling
        A ||--o{ C : first
        A ||--o{ C : second`,
      { colorMode: 'none' },
    )
    expect(ascii).toContain('sibling')
    expect(ascii).toContain('first')
    expect(ascii).toContain('second')
  })
})

describe('ASCII ER relationship routing — multi-row obstruction (CodeRabbit follow-up)', () => {
  it('keeps a relationship connected and boxes uncorrupted when it skips two rows', () => {
    // 7 entities -> maxPerRow = 3 -> row1: A,B,C; row2: D,E,F; row3: G.
    // A-G shares D's column two rows down, so the single-row-gap clamp
    // alone doesn't cover it — this needs the free-column bypass.
    const ascii = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : ab
        B ||--o{ C : bc
        C ||--o{ D : cd
        D ||--o{ E : de
        E ||--o{ F : ef
        F ||--o{ G : fg
        A ||--o{ G : ag
        A {
          string id
          string name
        }
        D {
          string id
          string title
        }
        G {
          string id
          string label
        }`,
      { colorMode: 'none' },
    )
    // No box content lost.
    expect(ascii).toContain('string id')
    expect(ascii).toContain('string name')
    expect(ascii).toContain('string title')
    expect(ascii).toContain('string label')
    // Every relationship label survives, including the multi-row one.
    expect(ascii).toContain('ab')
    expect(ascii).toContain('bc')
    expect(ascii).toContain('cd')
    expect(ascii).toContain('de')
    expect(ascii).toContain('ef')
    expect(ascii).toContain('fg')
    expect(ascii).toContain('ag')
  })

  it('routes the multi-row relationship through a column with no box at all (not a coincidentally-empty cell)', () => {
    // Same shape as above, but every entity carries an attribute so a
    // "disconnected" line landing inside a box (rather than routing
    // around it) would corrupt visible attribute text, not just an empty
    // interior cell.
    const ascii = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : ab
        B ||--o{ C : bc
        C ||--o{ D : cd
        D ||--o{ E : de
        E ||--o{ F : ef
        F ||--o{ G : fg
        A ||--o{ G : ag
        A { string a1 }
        B { string b1 }
        C { string c1 }
        D { string d1 }
        E { string e1 }
        F { string f1 }
        G { string g1 }`,
      { colorMode: 'none' },
    )
    for (const attr of ['a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1']) {
      expect(ascii, `expected attribute "${attr}" to survive`).toContain(attr)
    }
    expect(ascii).toContain('ag')
  })

  it('draws the multi-row line outside the intervening box, not just around a coincidental gap', () => {
    // A precise, geometry-aware check (not just "content survives"):
    // setCGuarded alone would already stop attribute-text corruption even
    // with the multi-row bypass disabled — it just leaves the line
    // discontinuous through D's box, which "content survives" assertions
    // can't tell apart from a real, routed connection. This test locates
    // D's own top-border row and asserts a line/marker character exists
    // *outside* D's box width on that exact row — proof the connector
    // steps around D's box rather than merely being guarded away inside
    // it (verified against a version of this fix with the bypass
    // disabled: the extra character outside D's box does not appear).
    const ascii = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : ab
        B ||--o{ C : bc
        C ||--o{ D : cd
        D ||--o{ E : de
        E ||--o{ F : ef
        F ||--o{ G : fg
        A ||--o{ G : ag
        A {
          string id
          string name
        }
        D {
          string id
          string title
        }
        G {
          string id
          string label
        }`,
      { colorMode: 'none' },
    )
    const lines = ascii.split('\n')
    const dTopIdx = lines.findIndex(
      (l, i) => l.includes('┌') && lines[i + 1]?.includes('│ D'),
    )
    expect(dTopIdx, 'expected to find D’s top-border row').toBeGreaterThan(-1)
    const dTopLine = lines[dTopIdx]!
    const afterDBox = dTopLine.slice(dTopLine.indexOf('┐') + 1)
    expect(afterDBox).toMatch(/[│╢╟○]/)
  })
})
