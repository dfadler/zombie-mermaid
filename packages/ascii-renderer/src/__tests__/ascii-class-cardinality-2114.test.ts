/**
 * Regression tests for issue #2114: the ASCII class renderer dropped every
 * relationship cardinality. Each one now sits beside the line, on the row next
 * to its own box, clear of the marker, the label and the box border.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { checkAll } from '../../../../__tests__/helpers/ascii-invariants.ts'

const render = (src: string, useAscii: boolean) =>
  renderMermaidASCII(src, { colorMode: 'none', useAscii })

/** Rows of the canvas as arrays of cells. */
const rows = (out: string) => out.split('\n').map((l) => [...l])

describe('ASCII class diagram: relationship cardinalities (issue #2114)', () => {
  const issue = `classDiagram
  Customer "1" --> "*" Order : places
  Order "1" --> "1..*" Item : contains
  Item "0..1" --> "many" Tag : has`

  for (const useAscii of [false, true]) {
    const charset = useAscii ? 'ascii' : 'unicode'

    it(`draws every cardinality from the issue (${charset})`, () => {
      const out = render(issue, useAscii)
      for (const c of ['1', '*', '1..*', '0..1', 'many']) {
        expect(out).toContain(` ${c}`)
      }
      // Both ends of each edge, next to the box they belong to.
      const lines = out.split('\n')
      const idx = (t: string) => lines.findIndex((l) => l.includes(t))
      expect(lines[idx('Customer') + 2]).toMatch(/ 1\s*$/) // Below Customer
      expect(lines[idx('Order') - 2]).toMatch(/ \*\s*$/) // Above Order
      expect(lines[idx('Item') - 2]).toMatch(/ 1\.\.\*\s*$/)
      expect(lines[idx('Item') + 2]).toMatch(/ 0\.\.1\s*$/)
      expect(lines[idx('Tag') - 2]).toMatch(/ many\s*$/)
    })

    it(`keeps the canvas rules and the labels intact (${charset})`, () => {
      const out = render(issue, useAscii)
      expect(checkAll(out, { unicode: !useAscii })).toEqual([])
      for (const l of ['places', 'contains', 'has']) expect(out).toContain(l)
    })

    it(`never overwrites a marker for any relationship kind (${charset})`, () => {
      const src = `classDiagram
  Animal "1" <|-- "0..*" Dog
  Car "1" *-- "4" Wheel
  Library "1" o-- "*" Book : holds
  Service "1" ..> "1..*" Config : reads
  Duck "*" ..|> "1" Swimmer
  Cart "1" --> Item`
      const out = render(src, useAscii)
      const bare = render(src.replace(/"[^"]*"\s*/g, ''), useAscii)
      // Same markers with and without cardinalities (the ASCII charset's
      // marker letters collide with cardinality text, so count unicode only).
      if (!useAscii) {
        const markers = /[△▽◆◇▲▼]/g
        expect(out.match(markers)?.length).toBe(bare.match(markers)?.length)
      }
      for (const c of ['0..*', '1..*', '4']) expect(out).toContain(` ${c}`)
      expect(checkAll(out, { unicode: !useAscii })).toEqual([])
    })
  }

  it('draws a cardinality at one end only', () => {
    const out = render(`classDiagram\n  A "1" --> B\n  C --> "n" D`, false)
    const r = rows(out)
    expect(out).toContain('│ 1')
    expect(out).toContain('▼ n')
    expect(r.flat().filter((c) => c === '1')).toHaveLength(1)
  })

  it('works with and without an edge label, on the correct side of the label', () => {
    const labelled = render(`classDiagram\n  A "x" --> "y" B : edge`, false)
    const lines = labelled.split('\n').map((l) => l.trimEnd())
    const at = (t: string) => lines.findIndex((l) => l.includes(t))
    expect(at('│ x')).toBeLessThan(at('edge'))
    expect(at('edge')).toBeLessThan(at('▼ y'))
    const bare = render(`classDiagram\n  A "x" --> "y" B`, false)
    expect(bare).toContain('│ x')
    expect(bare).toContain('▼ y')
  })

  it('makes room for a two-line label between the cardinalities', () => {
    const out = render(
      `classDiagram\n  A "1" --> "*" B : line one<br>line two`,
      false,
    )
    expect(out).toContain('│ 1')
    expect(out).toContain('line one')
    expect(out).toContain('line two')
    expect(out).toContain('▼ *')
  })

  it('keeps each cardinality beside its own line when classes share an end', () => {
    const out = render(
      `classDiagram
  Teacher "1" --> "*" Course : teaches
  Student "*" --> "*" Course : takes`,
      false,
    )
    expect(out.match(/\*/g)).toHaveLength(3)
    expect(out.match(/1/g)).toHaveLength(1)
    // The converging arrowheads' own jog shapes are the same without cardinalities.
    const bare = render(
      `classDiagram\n  Teacher --> Course : teaches\n  Student --> Course : takes`,
      false,
    )
    expect(checkAll(out, { unicode: true })).toHaveLength(
      checkAll(bare, { unicode: true }).length,
    )
  })

  it('draws cardinalities of a same-level relationship', () => {
    const out = render(
      `classDiagram
  A "p" --> "q" B
  B "r" --> "s" C
  C "t" --> "u" A`,
      false,
    )
    for (const c of ['p', 'q', 'r', 's', 't', 'u']) {
      expect(out).toMatch(new RegExp(`(^|\\s)${c}(\\s|$)`, 'm'))
    }
  })

  it('draws cardinalities when the line detours around a box', () => {
    const out = render(
      `classDiagram
  A "a1" --> "a2" B
  B "b1" --> "b2" C
  A "c1" --> "c2" C`,
      false,
    )
    for (const c of ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']) {
      expect(out).toContain(c)
    }
    expect(checkAll(out, { unicode: true })).toEqual([])
  })

  it('leaves a diagram without cardinalities unchanged', () => {
    const out = render(`classDiagram\n  A --> B : x\n  B <|-- C`, false)
    expect(out.split('\n').map((l) => l.trimEnd())).toEqual([
      '┌───┐',
      '│ A │',
      '└───┘',
      '  │',
      '  x',
      '  ▼',
      '┌───┐',
      '│ B │',
      '└───┘',
      '  △',
      '  │',
      '  │',
      '┌───┐',
      '│ C │',
      '└───┘',
      '',
      '',
    ])
  })

  it('keeps wide-character cardinalities whole', () => {
    const out = render(`classDiagram\n  A "一対多" --> "多" B`, false)
    expect(out).toContain('一対多')
    expect(out).toContain('▼ 多')
  })
})
