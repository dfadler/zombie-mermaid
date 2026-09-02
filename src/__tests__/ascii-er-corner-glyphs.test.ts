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
    // The detour's horizontal run now opens with '└' (turning up out of the
    // left vertical drop) and closes with '┘' (turning up into the right
    // vertical drop) instead of plain '─' at both ends.
    expect(ascii).toContain('└─────────────────│─────────────────┘')
    expect(ascii).toContain('relates_to')
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
    expect(ascii).toContain('│┐ opens')
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
    // Corner glyphs at both jogs of the bypass route.
    expect(ascii).toContain('┌─────────│──────────────────┘')
    expect(ascii).toContain('○╟─────────┘')
    expect(ascii).toContain('ag')
  })
})
