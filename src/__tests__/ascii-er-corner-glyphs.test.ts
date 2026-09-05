// ============================================================================
// ASCII ER diagram: routed relationship lines get a corner glyph at each
// jog/detour turn (issue #414)
//
// renderErAscii drew every relationship line, jog, and detour purely out of
// plain '─'/'│' segments meeting at unmarked right angles, even at a point
// where the routed path actually changes direction. In a dense diagram this
// reads ambiguously: a viewer can't tell "this line turns here" from "this
// line ends here and an unrelated line begins right next to it".
//
// The fix draws a box-drawing corner glyph ('┌'/'┐'/'└'/'┘', or '+' in ASCII
// mode) at each of the three routing paths that can change direction:
//   - the same-row detour beneath an obstructing entity
//     (`obstructionBottom`/`detourY`)
//   - a vertical relationship's horizontal jog (`needsJog`/`pickBandY`/`midY`)
//   - a vertical relationship's multi-row-obstruction bypass
//     (`multiRowObstruction`/`routingX`)
// through the same setCGuarded occupancy guard as every other relationship
// write, so a corner can never overwrite an entity box border or another
// relationship's label (the same corruption shape #391 fixed).
//
// Each assertion below pins an exact substring of the rendered output that
// was verified (via a before/after diff against the pre-fix renderer) to
// contain the new corner glyph at the exact cell the path turns, and to be
// completely absent from the pre-fix render. Reverting the fix in
// src/ascii/er-diagram.ts makes every one of these assertions fail — the
// dashes/lines render as before, without the corner character.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('ASCII ER relationship routing draws a corner glyph at each turn (issue #414)', () => {
  it('draws corner glyphs at a same-row detour around an obstructing entity', () => {
    // FIRST_ENTITY and THIRD_ENTITY are same-row, non-adjacent (MIDDLE_ENTITY
    // sits between them), so "relates_to" must detour beneath
    // MIDDLE_ENTITY's box. FOURTH_ENTITY/FIFTH_ENTITY exist only to keep this
    // component's row width at 3 (sqrt-based row limit), same trick REPRO_*
    // in ascii-er-relationship-label-corruption-350.test.ts uses.
    const ascii = renderMermaidASCII(
      `erDiagram
        FIRST_ENTITY ||--|{ MIDDLE_ENTITY : contains
        MIDDLE_ENTITY ||--o{ THIRD_ENTITY : includes
        FIRST_ENTITY ||--o| THIRD_ENTITY : relates_to
        FIRST_ENTITY ||--o{ FOURTH_ENTITY : owns
        MIDDLE_ENTITY ||--o{ FIFTH_ENTITY : tracks`,
      { colorMode: 'none' },
    )
    // The detour's horizontal run opens with '└' (turning up out of the
    // left vertical drop) and closes with '┘' (turning up into the right
    // vertical drop) instead of plain '─' at both ends.
    //
    // MIDDLE_ENTITY's own vertical "one" marker for its "tracks"
    // relationship no longer crosses this detour row directly — #390's
    // flush-marker change (merged after this test was first written) puts
    // the marker flush against MIDDLE_ENTITY's own border, one row above
    // the detour line, rather than inset into the detour's own row the
    // way the old inset positioning did. Checked separately below instead
    // of assuming they share a row.
    expect(ascii).toContain('└─────────────── tracks ────────────┘')
    const lines = ascii.split('\n')
    const detourLineIndex = lines.findIndex((l) =>
      l.includes('└─────────────── tracks ────────────┘'),
    )
    expect(detourLineIndex).toBeGreaterThan(0)
    // MIDDLE_ENTITY's "tracks" marker ('┼', flush against its own border)
    // sits on the row immediately above the detour line.
    expect(lines[detourLineIndex - 1]).toMatch(/┼/)
    expect(ascii).toContain('relates_to')
    expect(ascii).toContain('tracks')
    expect(ascii).not.toMatch(/[a-z]+[─│┊╌][a-z]+/)
  })

  it("draws corner glyphs at a vertical relationship's horizontal jog", () => {
    // USER and SESSION don't share a center column, so "opens" needs a
    // horizontal jog partway down — the exact repro from
    // ascii-er-jog-stray-line.test.ts's stray-duplicate-line fix.
    const ascii = renderMermaidASCII(
      `erDiagram
        USER ||--o{ LOG_ENTRY : generates
        USER ||..o{ SESSION : opens`,
      { colorMode: 'none' },
    )
    // The jog's dashed line ('╌', a non-identifying relationship) opens
    // with a solid '┐' corner glyph at the turn instead of another dash.
    // USER's own vertical "one" marker for this relationship ('┼', a
    // crossing tick rather than '│', which would blend into the plain
    // line, or a bare '─', which would sever it — see getCrowsFootChars'
    // `vertical` param) sits flush against USER's own border, one row
    // above the jog — not fused onto the same row as the jog's corner
    // (#390's flush-marker change, merged after this test was first
    // written, shifted the marker there).
    const lines = ascii.split('\n')
    const jogLineIndex = lines.findIndex((l) => l.includes('└┐ opens'))
    expect(jogLineIndex).toBeGreaterThan(0)
    expect(lines[jogLineIndex - 1]).toMatch(/┼/)
  })

  it('draws the ASCII-mode corner glyph ("+") at the same jog, in useAscii mode', () => {
    // Same repro and turn as the Unicode jog test above — getCornerChar's
    // useAscii branch (a plain '+', matching getCrowsFootChars' own
    // Unicode/ASCII split) has no Unicode-mode equivalent path, so it needs
    // its own coverage rather than assuming the Unicode assertion implies it.
    // Both adjacent corners use the same '+' glyph regardless of direction
    // in ASCII mode, so the two-corner pair reads as '++' rather than
    // Unicode's direction-distinct '└┐' — see the Unicode test above for
    // why there are two adjacent corners here at all.
    const ascii = renderMermaidASCII(
      `erDiagram
        USER ||--o{ LOG_ENTRY : generates
        USER ||..o{ SESSION : opens`,
      { colorMode: 'none', useAscii: true },
    )
    // Both '+' characters are the jog's own two adjacent corner glyphs
    // (ASCII mode uses a plain '+' for every corner direction — see the
    // Unicode test above, which shows the same shape as '└┐'). USER's own
    // vertical "one" marker sits on its own row above this line, flush
    // against USER's border (#390's flush-marker change) — not fused onto
    // this line the way an earlier version of this comment assumed.
    expect(ascii).toContain('++ opens')
  })

  it("draws corner glyphs at a vertical relationship's multi-row-obstruction bypass", () => {
    // Same 7-entity, 3-row shape as the multi-row-obstruction regression in
    // ascii-er-relationship-label-corruption-350.test.ts: A-G shares D's
    // column two rows down, so "ag" must bypass through a free column with
    // two short jogs (one leaving A's row, one entering G's row).
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
    // Corner glyphs at both jogs of the bypass route. G is also the shared
    // target of "fg" (from F, same row as G) and "ag" (this bypass) — since
    // issue #453, each gets its own staggered attachment column instead of
    // both landing on G's exact center, which shifts these exact strings
    // from a single shared-center bypass to two side-by-side ones; the
    // corner glyphs at the bypass's own turns are still there, just at the
    // updated column.
    expect(ascii).toContain('┌─│──────────────────┘')
    expect(ascii).toContain('○╟─────────────────┘')
    expect(ascii).toContain('ag')
  })

  it('handles a bypass whose free column search finds a match to the left, not just to the right', () => {
    // Same shape as the bypass test above, but D's box is widened enough
    // that the free-column search (which tries lineX+offset before
    // lineX-offset at every step — see columnClearOfBoxes' caller) exhausts
    // rightward space and finds its match on the left side instead. This
    // exercises the *other* branch of the horizDirAtLine/horizDirAtLower
    // ternaries in the bypass block — every other test in this file only
    // ever exercises the rightward case, since a plain sqrt-based row
    // layout with same-sized entities always searches rightward-first
    // successfully.
    //
    // In this specific diagram, the matched free column (routingX) lands
    // off-canvas (negative — nothing to A's own left in this narrow
    // layout), and the two corners at valid coordinates (A's own column,
    // and G's own column) both land exactly on cells the crow's-foot
    // markers already occupy — the marker legitimately wins there (same
    // precedence as the rightward case: markers are drawn after corners,
    // see drawCorner's own doc comment), so there's no *visible* new
    // glyph to assert on here. What this test actually pins down is that
    // reaching that branch doesn't corrupt anything or throw — content
    // integrity, not a specific rendered character.
    const ascii = renderMermaidASCII(
      `erDiagram
        A ||--o{ B : ab
        B ||--o{ C : bc
        C ||--o{ D : cd
        D ||--o{ E : de
        E ||--o{ F : ef
        F ||--o{ G : fg
        A ||--o{ G : ag
        D {
          string this_is_a_very_long_attribute_name_to_widen_the_box
        }
        G {
          string id
        }`,
      { colorMode: 'none' },
    )
    expect(ascii).toContain('ag')
    expect(ascii).toContain('string id')
    expect(ascii).toContain(
      'string this_is_a_very_long_attribute_name_to_widen_the_box',
    )
    expect(ascii).not.toMatch(/[a-z]+[─│┊╌][a-z]+/)
  })

  it('does not corrupt content when the bypass free-column search matches lineX itself (content-integrity coverage only)', () => {
    // The obstruction that triggers multiRowObstruction is detected within
    // the narrow row-gap band (bandTop..bandBottom — see the comment above
    // that check), but the free-column search below scans the *full*
    // startY..endY span. When the obstruction is confined to the band and
    // lineX's own column is otherwise clear across the fuller span, offset
    // 0 of that search succeeds immediately at lineX itself — so
    // `routingX === lineX`, skipping the "if (lineX !== routingX)" corner
    // block entirely (every other bypass test in this file has
    // routingX !== lineX, since a same-sized-entity layout's obstruction
    // isn't usually confined that way). Found the same way as the
    // leftward-bypass case above: varying A's own attribute width while
    // instrumenting routingX locally, not by construction alone.
    //
    // When that block is skipped, nothing observably distinguishes this
    // render from an equivalent diagram that never triggered
    // multiRowObstruction at all — skipping the block draws no corner, so
    // there is no glyph unique to this path to assert on (raised in review
    // on this PR: the assertions below prove the branch doesn't corrupt
    // content or throw when reached, not that it visibly changed anything —
    // hence this test's name and scope are deliberately about integrity,
    // not a specific rendered character).
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
          string x
        }`,
      { colorMode: 'none' },
    )
    expect(ascii).toContain('ag')
    expect(ascii).toContain('string x')
    expect(ascii).not.toMatch(/[a-z]+[─│┊╌][a-z]+/)
  })
})
