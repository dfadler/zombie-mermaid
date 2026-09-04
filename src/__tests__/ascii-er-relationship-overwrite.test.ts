// ============================================================================
// ASCII ER diagram: relationship draws must not overwrite already-placed
// text (GitHub issue #392)
//
// Relationships are drawn in declaration order. A later relationship's
// straight connecting line, crow's-foot marker, or label can land on the
// exact canvas cell an earlier relationship's label (or an entity's own
// header/attribute text) already wrote, silently corrupting it — a stray
// line glyph mid-word, or one label's characters spliced into another's.
// This is a distinct mechanism from #351's jog-row collisions (fixed by
// chooseFreeRow in #390): here nothing routes around anything, a later
// write simply stomps an earlier one with no occupancy check at all.
//
// A vertical relationship's label goes one step further than plain
// overwrite-avoidance: when multiple vertical relationships share the same
// upper/lower entity "rows" (and so the same natural label row), simply
// refusing to overwrite would silently drop every label but the first —
// a real information loss, not just a corruption risk. Those labels
// instead search nearby rows within the relationship's own vertical run
// for a free spot before giving up.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('ASCII ER relationship draws do not overwrite existing text (issue #392)', () => {
  it('does not let a later vertical relationship line cut through an earlier label', () => {
    // A-D's label "helloworld" and B-E's vertical connector line land on
    // the same canvas cell (both components span the same two rows), with
    // B-E's own label positioned clear of A-D's label span so this isolates
    // the line-vs-label collision from any label-vs-label collision.
    const ascii = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : ab
        A ||--o{ C : ac
        A ||--o{ D : helloworld
        B ||--o{ E : be`,
      { colorMode: 'none' },
    )

    expect(ascii).toContain('helloworld')
    expect(ascii).toContain('be')
  })

  it('does not let one relationship label overwrite another relationship label', () => {
    // A-D's label "longlabelhere" and B-E's label "be" are both centered on
    // the same row (both components span the same two rows) and, without a
    // guard, B-E's label characters land on top of the tail of A-D's label.
    const ascii = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : ab
        A ||--o{ C : ac
        A ||--o{ D : longlabelhere
        B ||--o{ E : be`,
      { colorMode: 'none' },
    )

    expect(ascii).toContain('longlabelhere')
  })

  it('does not let a same-row relationship line overwrite an unrelated entity name it must cross', () => {
    // A-C is a direct (non-adjacent) same-row relationship; entity B sits
    // physically between A and C, so A-C's straight line crosses B's box.
    // The routing itself (line running through the box) is a distinct,
    // out-of-scope defect (see #390's "known limitation" on non-adjacent
    // same-row collisions) — this test only asserts the crossing line
    // doesn't corrupt B's own header text.
    const ascii = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : ab
        A ||--o{ C : ac
        A ||--o{ D : helloworld
        B ||--o{ E : be`,
      { colorMode: 'none' },
    )

    // The A-C line still crosses straight through B's row (the crossing
    // itself is the out-of-scope routing defect) — but B's own header
    // character must survive that crossing intact rather than being
    // replaced by a line glyph.
    const lines = ascii.split('\n')
    const crossingLine = lines.find(
      (l) => l.includes('A') && l.includes('C') && l.includes('B'),
    )
    expect(crossingLine).toBeDefined()
    expect(crossingLine).toContain('B')
  })

  it('never splices one overlapping label onto another, whatever the outcome', () => {
    // Real catalog sample ("ER: Blog Platform Schema"): USER-COMMENT's
    // "authors" label, POST-COMMENT's "has" label, and POST-TAG's
    // "tagged-with" label all naturally land on the same row. Before any
    // fix, the whole row was overwritten down to just "tagged-with"
    // (silently erasing "authors" and "has" entirely). A naive
    // per-character occupancy guard produces a worse failure mode here:
    // "tagged-with"'s free trailing characters ("ged-with") get written
    // right after "has", producing "hasged-with" — a new, plausible-
    // looking word that is neither original label. Whether a colliding
    // label ends up relocated to a free row nearby or dropped outright
    // (see the row-search test below for which one happens here), it must
    // never partially splice into whatever's already at its natural row.
    const ascii = renderMermaidASCII(
      `erDiagram
        USER ||--o{ POST : writes
        USER ||--o{ COMMENT : authors
        POST ||--o{ COMMENT : has
        POST }|--o{ TAG : tagged-with`,
      { colorMode: 'none' },
    )

    expect(ascii).not.toContain('hasged-with')
    expect(ascii).not.toContain('gedauthors')
    expect(ascii).toContain('authors')
    expect(ascii).toContain('has')
  })

  it('relocates a colliding vertical-relationship label to a free row instead of dropping it', () => {
    // Same real catalog sample as above. USER-COMMENT, POST-COMMENT, and
    // POST-TAG all share the same startY/endY (they connect the same pair
    // of entity "rows" in the grid layout), so their labels ("authors",
    // "has", "tagged-with") all compute the identical natural midY. Simply
    // dropping whichever one loses that collision — the earlier behavior —
    // is a real, visible information loss: a rendered relationship with no
    // label at all. There's free space a row away, clear of both text and
    // markers, so "tagged-with" should be relocated there rather than
    // vanish.
    const ascii = renderMermaidASCII(
      `erDiagram
        USER ||--o{ POST : writes
        USER ||--o{ COMMENT : authors
        POST ||--o{ COMMENT : has
        POST }|--o{ TAG : tagged-with`,
      { colorMode: 'none' },
    )

    expect(ascii).toContain('tagged-with')
    // And still not spliced together with "has" on its new row either.
    expect(ascii).not.toContain('hastagged-with')
  })

  it('positions a jogged label next to the marker for the entity it actually describes', () => {
    // Real catalog sample ("ER: Blog Platform Schema", used verbatim — see
    // the row-search test above for why the attribute blocks matter here).
    // A label's X position used to follow the relationship's column at its
    // *upper* entity (POST, in this case) even when a jog moved the path
    // over to the lower entity's column — so "tagged-with" rendered far
    // from TAG's own marker, floating in the gap between it and COMMENT's
    // markers with nothing visually tying it to what it describes. The
    // label now follows the same target column the lower marker uses, so
    // it sits immediately next to that marker instead.
    const ascii = renderMermaidASCII(
      `erDiagram
        USER {
          int id PK
          string username UK
          string email UK
          date joined
        }
        POST {
          int id PK
          string title
          text content
          int author_id FK
          date published
        }
        COMMENT {
          int id PK
          text body
          int post_id FK
          int user_id FK
          date created
        }
        TAG {
          int id PK
          string name UK
        }
        USER ||--o{ POST : writes
        USER ||--o{ COMMENT : authors
        POST ||--o{ COMMENT : has
        POST }|--o{ TAG : tagged-with`,
      { colorMode: 'none' },
    )

    const lines = ascii.split('\n')
    const labelRow = lines.findIndex((l) => l.includes('tagged-with'))
    expect(labelRow).toBeGreaterThanOrEqual(0)
    const labelCol = lines[labelRow]!.indexOf('tagged-with')
    // The label starts 2 columns after the target column TAG's own lower
    // crow's-foot marker is built around — i.e. 3 columns after where a
    // 2-character marker like "○╟" begins (see targetX in the source).
    // The jog's row is chosen independently to dodge collisions with
    // other relationships (issue #351's chooseFreeRow), so the marker and
    // label aren't guaranteed to land on the exact same printed row —
    // search a small vertical window around the label instead of
    // requiring literal same-row adjacency.
    const markerCol = labelCol - 3
    const nearbyRows = [
      labelRow - 1,
      labelRow,
      labelRow + 1,
      labelRow + 2,
    ].filter((r) => r >= 0 && r < lines.length)
    const hasAlignedMarker = nearbyRows.some(
      (r) => lines[r]!.slice(markerCol, markerCol + 2) === '○╟',
    )
    expect(hasAlignedMarker).toBe(true)
  })

  it('drops a whole overlapping label in the same-row (horizontal) branch too', () => {
    // A-C is a direct, non-adjacent same-row relationship skipping over B,
    // so its label's clamped placement region spans the whole A..C gap and
    // can land on top of A-B's own (already-drawn, adjacent) label. The
    // vertical-branch case above exercises canPlaceLabelLine via the
    // vertical label loop; this exercises the same guard in the horizontal
    // label loop.
    const ascii = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : early
        A ||--o{ C : longlonglabelhere
        A ||--o{ D : y
        B ||--o{ E : z`,
      { colorMode: 'none' },
    )

    expect(ascii).toContain('early')
    expect(ascii).not.toContain('longlonglabelhere')

    // Not just the whole string: a per-character collision guard (the
    // naive approach tried and rejected for canPlaceLabelLine, see above)
    // could still leak part of the dropped label — e.g. "longlon" or
    // "glabelhere" — into the gap right after "early" on the same row.
    // Nothing alphabetic should appear there at all.
    const labelRow = ascii.split('\n').find((l) => l.includes('early'))
    expect(labelRow).toBeDefined()
    const afterEarly = labelRow!.slice(
      labelRow!.indexOf('early') + 'early'.length,
    )
    expect(afterEarly).not.toMatch(/[A-Za-z]/)
  })

  it('preserves an unrelated entity box border when a same-row line crosses through it', () => {
    // Real catalog sample ("ER: Mixed Identifying & Non-Identifying"):
    // ORDER-SHIPMENT is a direct, non-adjacent same-row relationship
    // skipping over LINE_ITEM, so its dashed line crosses straight through
    // LINE_ITEM's box (the routing itself — crossing through the box at all
    // — is the separate, out-of-scope defect from #351/#390's "known
    // limitation"). Text protection alone (the earlier tests above) keeps
    // "LINE_ITEM" itself readable, but previously left the crossing line
    // free to erase the box's border characters on either side of it,
    // leaving an open-looking, broken box. Border cells are protected too.
    const ascii = renderMermaidASCII(
      `erDiagram
        ORDER ||--|{ LINE_ITEM : contains
        ORDER ||..o{ SHIPMENT : ships-via
        PRODUCT ||--o{ LINE_ITEM : includes
        PRODUCT ||..o{ REVIEW : receives`,
      { colorMode: 'none' },
    )

    expect(ascii).toContain('┌───────────┐')
    expect(ascii).toContain('└───────────┘')
    // The crossing dashed line still runs right up to LINE_ITEM's box (that
    // routing gap is out of scope), so its own '╌' sits just inside the
    // border on both sides — but the border characters themselves must
    // survive intact, not be replaced by more line/dash glyphs.
    expect(ascii).toMatch(/│.LINE_ITEM.│/)
  })

  it('pads a label with a blank cell when a later relationship jog runs flush against it', () => {
    // Real catalog sample ("ER: Blog Platform Schema", used verbatim —
    // this needs the entities' attribute blocks to reproduce the exact
    // geometry where it occurs): USER-COMMENT needs no horizontal jog of
    // its own (its two entities are already column-aligned), so its label
    // "authors" sits on a row that POST-COMMENT's much longer jog — a
    // different, later-processed relationship — later fills with dashes
    // clear across. isProtected alone keeps "authors" itself intact
    // (that's what the earlier tests above cover), but without this
    // padding the crossing dashes still ran flush against it on both sides
    // ("────authors────") — readable, but visually indistinguishable from
    // actual corruption at a glance.
    const ascii = renderMermaidASCII(
      `erDiagram
        USER {
          int id PK
          string username UK
          string email UK
          date joined
        }
        POST {
          int id PK
          string title
          text content
          int author_id FK
          date published
        }
        COMMENT {
          int id PK
          text body
          int post_id FK
          int user_id FK
          date created
        }
        TAG {
          int id PK
          string name UK
        }
        USER ||--o{ POST : writes
        USER ||--o{ COMMENT : authors
        POST ||--o{ COMMENT : has
        POST }|--o{ TAG : tagged-with`,
      { colorMode: 'none' },
    )

    const row = ascii.split('\n').find((l) => l.includes('authors'))
    expect(row).toBeDefined()
    const idx = row!.indexOf('authors')
    expect(row![idx - 1]).toBe(' ')
    expect(row![idx + 'authors'.length]).toBe(' ')
  })
})
