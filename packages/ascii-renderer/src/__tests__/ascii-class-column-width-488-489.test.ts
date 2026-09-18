/**
 * Regression tests for #488 and #489 — `renderClassAscii`'s column layout
 * sized each class's horizontal slot purely from the box's own content, so
 * anything a relationship needed beside a narrow box had nowhere to go:
 *
 * - #488: a long label on a single-letter class (the "All 6 Relationship
 *   Types" sample) collided with its neighbours' labels and the territory
 *   pass truncated all of them to `…`, even though the diagram could simply
 *   have spread its columns further apart.
 * - #489: more than two relationships between a narrow pair fanned their
 *   per-pair column offsets (the #448 fix) wider than the box, and
 *   clamping every offset back inside the box collapsed distinct
 *   relationships onto one connection point — the later one silently
 *   overwrote the earlier one's line, arrowhead, and label, exactly the
 *   #448 failure mode at a higher relationship count.
 *
 * The fix reserves each class's slot from what its relationships overhang
 * past the box (labels centered on their lanes, and the full spread of a
 * fanned group), keeps every relationship's *lane* distinct, and joins a
 * lane that sits outside its box back to a border anchor with a short jog.
 */

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { assertUniformDisplayWidth } from './helpers/terminal-display-width.ts'

/** Same source as the "Class: All 6 Relationship Types" sample (samples-data.ts). */
const ALL_SIX = `classDiagram
  A <|-- B : inheritance
  C *-- D : composition
  E o-- F : aggregation
  G --> H : association
  I ..> J : dependency
  K ..|> L : realization`

const ALL_SIX_LABELS = [
  'inheritance',
  'composition',
  'aggregation',
  'association',
  'dependency',
  'realization',
]

/** The #489 repro: four relationships between two width-5 boxes. */
const FOUR_BETWEEN_NARROW_PAIR = `classDiagram
  class A
  class B
  A --> B : one
  A --> B : two
  A --> B : three
  A --> B : four`

/** Column of the first occurrence of `needle` on the first line containing it. */
function columnOf(lines: string[], needle: string): number {
  const line = lines.find((l) => l.includes(needle))
  if (line === undefined) throw new Error(`"${needle}" not found`)
  return line.indexOf(needle)
}

describe('ASCII class diagram — column width reserves room for relationship labels (issue #488)', () => {
  it('renders every label of the "All 6 Relationship Types" sample in full, with no ellipsis', () => {
    const ascii = renderMermaidASCII(ALL_SIX, { colorMode: 'none' })
    for (const label of ALL_SIX_LABELS) {
      expect(ascii).toContain(label)
    }
    expect(ascii).not.toContain('…')
  })

  it('keeps each label centered under its own class column, in source order', () => {
    const lines = renderMermaidASCII(ALL_SIX, { colorMode: 'none' }).split('\n')
    const labelCols = ALL_SIX_LABELS.map((l) => columnOf(lines, l))
    // Left to right, matching the classes' order in the level.
    expect([...labelCols].sort((a, b) => a - b)).toEqual(labelCols)

    // Each label straddles the column its relationship's line runs along:
    // the marker glyph directly above/below it sits within the label's span.
    const markerRow = lines.find((l) => l.includes('△'))!
    const markerCols = [...markerRow].flatMap((ch, i) =>
      ['△', '◆', '◇', '│', '┊'].includes(ch) ? [i] : [],
    )
    expect(markerCols).toHaveLength(6)
    ALL_SIX_LABELS.forEach((label, i) => {
      const start = labelCols[i]!
      const end = start + label.length - 1
      expect(markerCols[i]).toBeGreaterThanOrEqual(start)
      expect(markerCols[i]).toBeLessThanOrEqual(end)
    })
  })

  it('leaves a class whose box is already wider than its labels at the default gap', () => {
    // Nothing overhangs these boxes, so the reservation must not move them:
    // the two top borders stay exactly one horizontal gap (4 cells) apart.
    const ascii = renderMermaidASCII(
      `classDiagram
  class Teacher {
    +name String
  }
  class Student {
    +name String
  }
  class Course {
    +title String
  }
  Teacher --> Course : teaches
  Student --> Course : enrolled in`,
      { colorMode: 'none' },
    )
    const topBorder = ascii.split('\n')[0]!
    expect(topBorder).toMatch(/^┌─+┐ {4}┌─+┐\s*$/)
    expect(ascii).toContain('teaches')
    expect(ascii).toContain('enrolled in')
    expect(ascii).not.toContain('…')
  })
})

describe('ASCII class diagram — more than two relationships between a narrow pair (issue #489)', () => {
  it('renders all four labels in full, each on its own lane', () => {
    const ascii = renderMermaidASCII(FOUR_BETWEEN_NARROW_PAIR, {
      colorMode: 'none',
    })
    const lines = ascii.split('\n')
    expect(ascii).not.toContain('…')

    // All four on one row, left to right, none clipped by the canvas edge
    // (the failed local attempt in #489 lost `one` entirely and left `tw`).
    const labelRow = lines.find((l) => l.includes('one'))!
    expect(labelRow).toMatch(/\bone\b.*\btwo\b.*\bthree\b.*\bfour\b/)
  })

  it('gives every relationship its own arrowhead on the target border', () => {
    const lines = renderMermaidASCII(FOUR_BETWEEN_NARROW_PAIR, {
      colorMode: 'none',
    }).split('\n')

    const arrowRow = lines.findIndex((l) => l.includes('▼'))
    expect(arrowRow).toBeGreaterThanOrEqual(0)
    const arrowCols = [...lines[arrowRow]!].flatMap((ch, i) =>
      ch === '▼' ? [i] : [],
    )
    expect(arrowCols).toHaveLength(4)

    // Every arrowhead sits directly on top of B's top border — attached to
    // the box, not floating in the space its lane fanned out into.
    const bTop = lines[arrowRow + 1]!
    expect(bTop).toMatch(/┌─+┐/)
    const boxStart = bTop.indexOf('┌')
    const boxEnd = bTop.indexOf('┐')
    for (const col of arrowCols) {
      expect(col).toBeGreaterThanOrEqual(boxStart)
      expect(col).toBeLessThanOrEqual(boxEnd)
    }
  })

  it('draws a jog from each fanned-out lane back to the box border', () => {
    const lines = renderMermaidASCII(FOUR_BETWEEN_NARROW_PAIR, {
      colorMode: 'none',
    }).split('\n')
    // Row directly under A: a trunk of corners/tees running out to the
    // outer lanes on both sides.
    const aBottom = lines.findIndex((l) => l.includes('└───┘'))
    const jogRow = lines[aBottom + 1]!
    expect(jogRow).toMatch(/┌─+┬.*┬─+┐/)
  })

  it('does not add jogs to a group that already fits inside its boxes', () => {
    // A reciprocal pair on boxes wide enough for both lanes (the #448 MVC
    // shape) keeps the plain three-segment route — no junction glyphs.
    const ascii = renderMermaidASCII(
      `classDiagram
  class Model {
    +getData() Map
    +setData(key, val) void
  }
  class View {
    +render() void
    +update() void
  }
  Model ..> View : notifies
  View --> Model : reads`,
      { colorMode: 'none' },
    )
    expect(ascii).toContain('notifies')
    expect(ascii).toContain('reads')
    expect(ascii).not.toMatch(/[┬┴┼]/)
  })
})

// ----------------------------------------------------------------------------
// Additional coverage identified in review of PR #512 — real gaps the tests
// above don't exercise: a true zero-relationship baseline, a single (non-
// grouped) relationship's own reservation, a group whose members' labels are
// wildly different lengths, two independent multi-relationship groups in one
// diagram, double-width (CJK) label characters, one class's reach across
// several *unrelated* relationships (max, not sum), and the interaction with
// PR #514's detour routing.
// ----------------------------------------------------------------------------

describe('ASCII class diagram — column reservation baseline and single-relationship cases', () => {
  it('adds no extra width for classes with zero relationships (default gap only)', () => {
    // No relationships at all means `columnReach` never gets a nonzero left
    // or right for either class — the slot must stay exactly the box width,
    // same as if the reservation feature didn't exist.
    const ascii = renderMermaidASCII(
      `classDiagram
  class Foo
  class Bar`,
      { colorMode: 'none' },
    )
    const topBorder = ascii.split('\n')[0]!
    expect(topBorder).toMatch(/^┌─+┐ {4}┌─+┐\s*$/)
  })

  it('reserves room for a single (ungrouped) relationship label on a narrow box', () => {
    // Group size 1 — `relColumnOffset`/`relGroupSpread` are never populated
    // for this pair (the pair-grouping pass only fires for `group.length >=
    // 2`), so any extra room here must come from `columnReach` alone, not
    // from the fan-out logic #489 added. A single letter box is 5 cells wide
    // ("┌───┐"); a label many times that width has nowhere to go without
    // the slot growing past the box on at least one side.
    const ascii = renderMermaidASCII(
      `classDiagram
  class A
  class B
  A --> B : a label far wider than either narrow box`,
      { colorMode: 'none' },
    )
    const lines = ascii.split('\n')
    expect(ascii).not.toContain('…')
    expect(ascii).toContain('a label far wider than either narrow box')

    // The label's lane must carry zero fan offset (no group to fan within):
    // it sits centered under column 0 relative to both boxes, i.e. the same
    // column A and B's own centers occupy.
    const aTop = lines.find((l) => l.includes('┌───┐'))!
    const labelRow = lines.find((l) => l.includes('a label far wider'))!
    const aCenter = aTop.indexOf('┌') + 2 // "┌───┐" is 5 wide, center at +2
    const labelText = 'a label far wider than either narrow box'
    const labelStart = labelRow.indexOf(labelText)
    const labelCenter = labelStart + Math.floor(labelText.length / 2)
    expect(Math.abs(labelCenter - aCenter)).toBeLessThanOrEqual(1)
  })
})

describe('ASCII class diagram — a group whose members have wildly different label lengths', () => {
  const SOURCE = `classDiagram
  class A
  class B
  A --> B : hi
  B --> A : this is a much much longer label than the other one`

  it('renders both labels in full — the group spacing must key off the widest member', () => {
    // If the fan-out step were sized off the shortest label (or an average)
    // instead of the group's widest, the long label would overlap `hi`'s
    // lane (or the boxes) and the territory pass would truncate one or both
    // to an ellipsis.
    const ascii = renderMermaidASCII(SOURCE, { colorMode: 'none' })
    expect(ascii).not.toContain('…')
    expect(ascii).toContain('hi')
    expect(ascii).toContain(
      'this is a much much longer label than the other one',
    )
  })

  it('keeps the two labels non-overlapping on their shared row', () => {
    const lines = renderMermaidASCII(SOURCE, { colorMode: 'none' }).split('\n')
    const row = lines.find((l) => l.includes('hi'))!
    expect(row).toContain('this is a much much longer label than the other one')
    const hiStart = row.indexOf('hi')
    const hiEnd = hiStart + 1
    const longStart = row.indexOf(
      'this is a much much longer label than the other one',
    )
    const longEnd =
      longStart +
      'this is a much much longer label than the other one'.length -
      1
    const overlaps = hiStart <= longEnd && longStart <= hiEnd
    expect(overlaps).toBe(false)
  })
})

describe('ASCII class diagram — two independent multi-relationship groups in one diagram', () => {
  it("does not let one group's wide labels leak into a separate pair's spacing", () => {
    // A<->B carries a much wider label pair than C<->D. If group state leaked
    // (e.g. a shared "widest label seen so far" instead of one keyed per
    // pair), C/D would be pushed further apart than they need to be on their
    // own — this compares the actual C-D spacing against an isolated C/D-only
    // rendering with identical C/D relationships and nothing else.
    const combined = renderMermaidASCII(
      `classDiagram
  class A
  class B
  class C
  class D
  A --> B : short
  B --> A : another short one that is somewhat longer than short
  C --> D : x
  D --> C : y`,
      { colorMode: 'none' },
    ).split('\n')
    const isolated = renderMermaidASCII(
      `classDiagram
  class C
  class D
  C --> D : x
  D --> C : y`,
      { colorMode: 'none' },
    ).split('\n')

    const cRowCombined = combined.find((l) => l.includes('│ C │'))!
    const cRowIsolated = isolated.find((l) => l.includes('│ C │'))!
    const distanceCombined =
      cRowCombined.indexOf('D') - cRowCombined.indexOf('C')
    const distanceIsolated =
      cRowIsolated.indexOf('D') - cRowIsolated.indexOf('C')
    expect(distanceCombined).toBe(distanceIsolated)
  })
})

describe('ASCII class diagram — double-width (CJK) relationship labels', () => {
  it('measures column reservation by display width, not UTF-16 length', () => {
    // Each CJK character here is 2 terminal columns wide but 1 UTF-16 code
    // unit — if `labelCellWidth` measured `.length` instead of `displayWidth`
    // (the same class of bug already fixed for box content in #182 and for
    // sequence-diagram labels in #334), X/Y's reserved slot would come out
    // roughly half what the label actually needs. A sibling pair (W -> Z)
    // beside X -> Y gives that under-reservation somewhere to collide with:
    // with the bug, the CJK label runs into W/Z's column and the territory
    // pass truncates it to an ellipsis; with correct display-width
    // measurement, both labels render in full, each in its own lane.
    const ascii = renderMermaidASCII(
      `classDiagram
  class X
  class W
  class Y
  class Z
  X --> Y : 图表关系测试标签更多字
  W --> Z : short`,
      { colorMode: 'none' },
    )
    expect(ascii).not.toContain('…')
    expect(ascii).toContain('图表关系测试标签更多字')
    expect(ascii).toContain('short')
    assertUniformDisplayWidth(ascii)
  })
})

describe('ASCII class diagram — one class spanning several unrelated relationships (max, not sum)', () => {
  it("reserves room for a class's widest relationship only once, not once per relationship", () => {
    // A appears as the "to" of one long-labeled relationship and the "from"
    // of a second, short-labeled one to a different class entirely (not a
    // fan-out group — these are two distinct pairs, `P::A` and `A::Q`).
    // `columnReach` folds every relationship touching a class together with
    // `Math.max`; if that were `+=` instead, A's reserved slot would grow
    // with the *count* of its relationships rather than staying pinned to
    // the single widest one, and A's column would drift right of where it
    // sits when the long relationship is the only one touching it at all.
    const combined = renderMermaidASCII(
      `classDiagram
  class P
  class A
  class Q
  class R
  P --> A : the long label that needs a lot of horizontal room
  A --> Q : short
  Q --> R : also short`,
      { colorMode: 'none' },
    ).split('\n')
    const isolated = renderMermaidASCII(
      `classDiagram
  class P
  class A
  P --> A : the long label that needs a lot of horizontal room`,
      { colorMode: 'none' },
    ).split('\n')

    const aRowCombined = combined.find((l) => l.includes('│ A │'))!
    const aRowIsolated = isolated.find((l) => l.includes('│ A │'))!
    expect(aRowCombined.indexOf('A')).toBe(aRowIsolated.indexOf('A'))
  })
})

describe('ASCII class diagram — column reservation composes with detour routing (issue #514 interaction)', () => {
  // A -> B -> C is a straight chain, but A -> C also exists and — with
  // matching label lengths on all three relationships — A, B, and C end up
  // column-aligned, so A -> C's straight vertical path collides with B and
  // must detour (the same shape as the #487 MVC repro, but with narrow,
  // single-word boxes that also need `columnReach` to grow their slots for
  // these labels). D -> E is an unrelated, short-labeled pair placed beside
  // A/B/C by the layout — if A/B/C's slots were NOT widened for their long
  // labels, D/E would land close enough to collide with them. This is the
  // composition PR #512's column-width pass and PR #514's label-aware
  // detour routing must both get right at once.
  const SOURCE = `classDiagram
  class A
  class B
  class C
  class D
  class E
  A --> B : a moderately long label here
  A --> C : a moderately long label there
  B --> C : a moderately long label too
  D --> E : x`

  it('reserves room for every label while one relationship detours around the middle class', () => {
    const ascii = renderMermaidASCII(SOURCE, { colorMode: 'none' })
    const lines = ascii.split('\n')
    expect(ascii).not.toContain('…')
    for (const label of [
      'a moderately long label here',
      'a moderately long label there',
      'a moderately long label too',
      'x',
    ]) {
      expect(ascii).toContain(label)
    }

    // B's box borders give its column footprint; the detoured relationship's
    // label ("...there") must land clear of B's footprint, not overlapping
    // or truncated by it — the same "past the border, not inside it" check
    // the #487 suite uses for the MVC repro.
    const bTopRow = lines.findIndex(
      (l, i) =>
        l.includes('┌───┐') && (lines[i + 1]?.includes('│ B │') ?? false),
    )
    expect(bTopRow).toBeGreaterThanOrEqual(0)
    const bRightBorder = lines[bTopRow]!.indexOf('┐')

    const thereRow = lines.findIndex((l) =>
      l.includes('a moderately long label there'),
    )
    expect(thereRow).toBeGreaterThanOrEqual(0)
    const thereStart = lines[thereRow]!.indexOf('a moderately long label there')
    expect(thereStart).toBeGreaterThan(bRightBorder)
  })

  it("does not let D/E's short-labeled pair collide with A/B/C's reserved columns", () => {
    // If A/B/C's own slots weren't widened for their long labels, D -> E's
    // short "x" would land inside the space one of A/B/C's long labels
    // needs, corrupting it mid-string (this is exactly what a broken
    // reservation produces: e.g. "a moderat x  long label here" instead of
    // "a moderately long label here") rather than a clean ellipsis
    // truncation — so this checks the label text is byte-for-byte intact,
    // not just present as a substring.
    const ascii = renderMermaidASCII(SOURCE, { colorMode: 'none' })
    expect(ascii).toContain('a moderately long label here')
    expect(ascii).toContain('a moderately long label there')
    expect(ascii).toContain('a moderately long label too')
  })
})

// ----------------------------------------------------------------------------
// Precise patch-coverage gaps identified from PR #512's codecov report: the
// 8 tests above are legitimate but happen not to execute several specific
// lines/branches codecov tracks as new-in-this-diff. Each test below targets
// one exact gap (see the codecov `patch` DA:/BRDA: cross-reference against
// `git diff main...HEAD -- src/ascii/class-diagram.ts`), not a generic
// "more coverage" addition.
// ----------------------------------------------------------------------------

describe('ASCII class diagram — plain-ASCII jog rendering (drawJog useAscii branch)', () => {
  it('draws the fanned-lane jog with ASCII dashes/pipes, not box-drawing corners, under useAscii', () => {
    // `drawJog`'s `useAscii` branch (setJogCell with the ASCII line glyph on
    // both the anchor and the lane column, then an early return before the
    // corner-glyph arithmetic) is only reachable when a jog is actually
    // drawn (a fanned-out lane, same #489 shape as FOUR_BETWEEN_NARROW_PAIR)
    // *and* rendering in ASCII mode. Every existing jog test renders in the
    // default Unicode mode, so this branch — and the plain-ASCII jog cells
    // it writes — went untested.
    const ascii = renderMermaidASCII(FOUR_BETWEEN_NARROW_PAIR, {
      colorMode: 'none',
      useAscii: true,
    })
    expect(ascii).not.toContain('…')
    // Plain-ASCII jog cells use '-' (horizontal) — not the Unicode box
    // corners ('┌','┐','┴', etc.) the default-mode jog draws instead.
    expect(ascii).toMatch(/-{2,}/)
    expect(ascii).not.toMatch(/[┌┐└┘┬┴┼]/)
    for (const label of ['one', 'two', 'three', 'four']) {
      expect(ascii).toContain(label)
    }
  })
})

describe('ASCII class diagram — a detour that clears to the left of its source column', () => {
  // `findClearColumn` tries the column to the right of the source lane
  // before the one to the left, so every existing detour test (including
  // the #514-interaction suite above) happens to clear on the right —
  // `clearSide: 'left'` and the mirrored exit/entry corner-glyph branches it
  // feeds are never exercised. Shifting B's box one column right of A/C's
  // shared connection column (via an asymmetric-width label on B --> C)
  // makes the space immediately right of A's lane blocked for longer than
  // the space immediately left of it, so the search finds its clearance on
  // the left instead — confirmed by rendering and reading the actual
  // routed column positions before writing this test.
  const SOURCE = `classDiagram
  class A
  class B
  class C
  A --> B : a moderately long label here
  A --> C : a moderately long label there
  B --> C : a moderately long label tooXXX`

  it('routes the detour trunk left of the source lane and still renders every label intact', () => {
    const ascii = renderMermaidASCII(SOURCE, { colorMode: 'none' })
    const lines = ascii.split('\n')
    expect(ascii).not.toContain('…')
    expect(ascii).toContain('a moderately long label here')
    expect(ascii).toContain('a moderately long label there')
    expect(ascii).toContain('a moderately long label tooXXX')

    // A's own lane column (its box center).
    const aRow = lines.find((l) => l.includes('│ A │'))!
    const fromCX = aRow.indexOf('A')

    // The row directly above B's top border carries the detour's vertical
    // trunk segment (a lone '│' at the route column, undisturbed by any
    // label text): with a left detour that column sits left of fromCX,
    // never on or right of it (a right detour, the only case the existing
    // #514-interaction suite covers, would put it right of fromCX instead).
    const bTopRow = lines.findIndex(
      (l, i) =>
        l.includes('┌───┐') && (lines[i + 1]?.includes('│ B │') ?? false),
    )
    expect(bTopRow).toBeGreaterThan(0)
    const trunkRow = lines[bTopRow - 1]!
    const trunkCol = trunkRow.indexOf('│')
    expect(trunkCol).toBeGreaterThanOrEqual(0)
    expect(trunkCol).toBeLessThan(fromCX)
  })

  it('joins the trunk to C with a rightward entry jog, since the trunk lands left of C too', () => {
    // Exercises the entry-jog's `routeX < toAnchorX` branch (the trunk is
    // left of where it must enter C, so the jog runs rightward into C) —
    // every existing detour test's trunk lands at or right of its target
    // anchor instead, taking the opposite branch.
    const ascii = renderMermaidASCII(SOURCE, { colorMode: 'none' })
    const lines = ascii.split('\n')

    const cTopRow = lines.findIndex(
      (l, i) =>
        l.includes('┌───┐') && (lines[i + 1]?.includes('│ C │') ?? false),
    )
    expect(cTopRow).toBeGreaterThan(0)
    const entryRow = lines[cTopRow - 1]!
    // `routeX < toAnchorX` draws '└' at the trunk column and '┐' at the
    // anchor (jogging right into C); the mirrored `else` branch (every
    // other detour test's case) draws '┘' at the trunk column instead — so
    // the corner glyph itself, not just "something precedes the arrow",
    // distinguishes the two branches.
    expect(entryRow).toContain('└')
    expect(entryRow).not.toContain('┘')
    const arrowCol = entryRow.indexOf('▼')
    expect(arrowCol).toBeGreaterThanOrEqual(0)
    expect(entryRow.indexOf('└')).toBeLessThan(arrowCol)
  })
})

describe('ASCII class diagram — a fanned-out group routed upward (target above source)', () => {
  // The "target is above source" routing branch (a reciprocal-style edge
  // whose "to" class was already leveled shallower than its "from" class)
  // exists and is already covered elsewhere in the suite, but never
  // together with a *fanned* group needing its own jog on that branch —
  // `drawJog`'s call sites there (fromJogs/toJogs) were always false.
  // A -> B -> C -> D is a plain chain (so B/C/D each get a genuine,
  // strictly-deeper level), and D -> B (four relationships, forcing a fan)
  // is a back-edge the cycle-guard rejects for relevelling B — so B stays
  // above D, and D's fanned relationships into it draw upward.
  const SOURCE = `classDiagram
  class A
  class B
  class C
  class D
  A --> B : down1
  B --> C : down2
  C --> D : down3
  D --> B : one
  D --> B : two
  D --> B : three
  D --> B : four`

  it('renders all four upward relationships with distinct arrowheads into B, labels intact', () => {
    const ascii = renderMermaidASCII(SOURCE, { colorMode: 'none' })
    expect(ascii).not.toContain('…')
    for (const label of [
      'down1',
      'down2',
      'down3',
      'one',
      'two',
      'three',
      'four',
    ]) {
      expect(ascii).toContain(label)
    }

    // B sits above D in the render (the back-edge did not push B deeper).
    const lines = ascii.split('\n')
    const bRow = lines.findIndex((l) => l.includes('│ B │'))
    const dRow = lines.findIndex((l) => l.includes('│ D │'))
    expect(bRow).toBeGreaterThanOrEqual(0)
    expect(dRow).toBeGreaterThan(bRow)

    // Four upward arrowheads land on the row just below B's bottom border
    // (B's content row + 2: content, bottom border, then the fanned jog/
    // arrow row), one per relationship. This row's outer trunk corners
    // ('┬'/'┴' merged with the box-border tee) come from `drawJog`'s
    // `toJogs` side (line 1008/1005's loop) — B is the *target* of these
    // upward relationships.
    const arrowRow = bRow + 2
    const arrowCols = [...lines[arrowRow]!].flatMap((ch, i) =>
      ch === '▲' ? [i] : [],
    )
    expect(arrowCols.length).toBeGreaterThanOrEqual(4)
    // The outer ends of this row merge the fan's jog into B's own border
    // as clean corners ('┌' left, '┐' right) because `toJogs` pulls the
    // trunk's vertical run back by one row first — without that pullback
    // the merge instead produces a T-junction ('├'/'┤') against the box
    // border one row too early.
    expect(lines[arrowRow]).toContain('┌')
    expect(lines[arrowRow]).toContain('┐')
    expect(lines[arrowRow]).not.toMatch(/[├┤]/)

    // D is the *source* of these upward relationships — the row directly
    // above D's top border carries the mirrored `fromJogs` trunk (line
    // 989's loop): its outer edges are square corners ('└' left, '┘'
    // right) merged with the fan's horizontal run, not bare '│'s (which is
    // what an unadjusted/un-jogged trunk row would show instead).
    const dTopRow = lines.findIndex(
      (l, i) =>
        l.includes('┌───┐') && (lines[i + 1]?.includes('│ D │') ?? false),
    )
    expect(dTopRow).toBeGreaterThan(0)
    const dJogRow = lines[dTopRow - 1]!
    expect(dJogRow).toContain('└')
    expect(dJogRow).toContain('┘')
  })
})
