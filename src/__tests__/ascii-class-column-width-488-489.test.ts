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
import { renderMermaidASCII } from '../ascii/index.ts'

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
