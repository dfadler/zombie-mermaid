import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../index.ts'

// #2027: a connector glyph must join the stroke it leads to, and a fork/join
// bar must touch the stems that attach to it.
describe('state diagram orphan stubs (#2027)', () => {
  it('Active -> Idle stroke starts at the box connector, no blank gap', () => {
    const out = renderMermaidASCII(
      `stateDiagram-v2
  [*] --> Active
  note right of Active : this is a note
  Active --> Idle
  note left of Idle
    a note
    over two lines
  end note
  Idle --> [*]`,
    )
    const row = out.split('\n').find((l) => l.includes('Active'))!
    expect(row).toMatch(/Active\s+├─+┐/)
  })

  it('fork/join bars touch their stems', () => {
    const lines = renderMermaidASCII(
      `stateDiagram-v2
  state f <<fork>>
  state j <<join>>
  [*] --> f
  f --> A
  f --> B
  A --> j
  B --> j
  j --> [*]`,
    ).split('\n')
    const isBar = (l: string) => l.includes('█')
    const bars = lines.flatMap((l, i) => (isBar(l) ? [i] : []))
    expect(bars.length).toBeGreaterThan(0)
    for (const i of bars) {
      // Neighbouring rows are the bar, or carry a stem/arrow glyph: never blank.
      for (const j of [i - 1, i + 1]) {
        if (isBar(lines[j]!)) continue
        expect(lines[j]!.trim()).not.toBe('')
      }
    }
  })

  it('fork/join is a one-row bar, not a block', () => {
    const out = renderMermaidASCII(`stateDiagram-v2
  state f <<fork>>
  [*] --> f
  f --> A
  f --> B`)
    expect(out.split('\n').filter((l) => l.includes('█'))).toHaveLength(1)
  })

  const pseudo = `stateDiagram-v2
  state c <<choice>>
  [*] --> A
  A --> c
  c --> J
  B --> J
  J --> [*]`

  it('draws start, choice and end as single glyphs (Unicode)', () => {
    const out = renderMermaidASCII(pseudo)
    expect(out).toContain('◇')
    expect(out).toContain('●')
    expect(out).toContain('◉')
    expect(out).not.toMatch(/[╔╗◇]──/)
  })

  it('draws start, choice and end as single glyphs (ASCII)', () => {
    const out = renderMermaidASCII(pseudo, { useAscii: true })
    for (const g of ['o', '*', '@'])
      expect(out.split('\n').some((l) => l.split(/\s+/).includes(g))).toBe(true)
  })

  it('a start glyph fanning into a shared target is not teed', () => {
    const out = renderMermaidASCII(`stateDiagram-v2
  [*] --> J
  B --> J`)
    expect(out).toContain('●')
  })

  it('a choice glyph fanning into a shared target keeps its glyph', () => {
    const out = renderMermaidASCII(`stateDiagram-v2
  state c <<choice>>
  A --> c
  c --> J
  B --> J`)
    expect(out).toContain('◇')
  })

  // A taller sibling stretches the glyph's row/column; the arrow must still
  // land on the glyph, not stop short of it.
  it.each([
    [
      'TD',
      'Idle --> [*]\n  note left of Idle\n    a\n    b\n    c\n  end note',
    ],
    [
      'LR',
      'direction LR\n  Idle --> [*]\n  note left of Idle\n    a\n    b\n    c\n  end note',
    ],
  ])('the end glyph touches its arrow (%s)', (_d, body) => {
    const lines = renderMermaidASCII(`stateDiagram-v2\n  ${body}`).split('\n')
    const y = lines.findIndex((l) => l.includes('◉'))
    const x = lines[y]!.indexOf('◉')
    const arrow = _d === 'LR' ? lines[y]![x - 1] : lines[y - 1]![x]
    expect(arrow).toBe(_d === 'LR' ? '►' : '▼')
  })
})
