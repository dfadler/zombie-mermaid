/**
 * #1284: the two labels of a reciprocal pair (`A -->|x| B` + `B -->|y| A`)
 * share one vertical channel. They used to be drawn ON the stroke, cutting it
 * (`┼` / `y` / `│`); each now sits beside it, the down edge's to the right and
 * the up edge's to the left, when the cells there are free.
 *
 * The row stays where #530 put it (see ascii-state-bidirectional-label-swap-530).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (src: string): string[] =>
  renderMermaidASCII(src, { colorMode: 'none' }).split('\n')

/** The column of the box-start connector under A: where the strokes run. */
function strokeColumn(lines: string[]): number {
  const arrow = lines.findIndex((l) => l.includes('▲'))
  return lines[arrow]!.indexOf('▲')
}

describe('reciprocal pair labels sit beside the stroke (#1284)', () => {
  const PAIR = `graph TD
A -->|x| B
B -->|y| A`

  it('keeps the stroke unbroken on every row between the two nodes', () => {
    const lines = render(PAIR)
    const col = strokeColumn(lines)
    const up = lines.findIndex((l) => l.includes('▲'))
    const down = lines.findIndex((l) => l.includes('▼'))
    for (let row = up; row <= down; row++) {
      expect(lines[row]![col], `row ${row}: ${lines[row]}`).toMatch(/[▲│▼]/)
    }
  })

  it('puts the down edge label right of the stroke and the up edge label left of it', () => {
    const lines = render(PAIR)
    const col = strokeColumn(lines)
    const yRow = lines.find((l) => l.includes('y'))!
    const xRow = lines.find((l) => /\bx\b/.test(l))!
    expect(yRow.indexOf('y')).toBeLessThan(col)
    expect(xRow.indexOf('x')).toBeGreaterThan(col)
  })

  it('keeps the #530 row order: up label under the up arrowhead, down label above the down arrowhead', () => {
    const lines = render(PAIR)
    const up = lines.findIndex((l) => l.includes('▲'))
    const down = lines.findIndex((l) => l.includes('▼'))
    expect(lines.findIndex((l) => l.includes('y'))).toBe(up + 1)
    expect(lines.findIndex((l) => /\bx\b/.test(l))).toBe(down - 1)
  })

  it('keeps the stroke unbroken between two frames (the issue repro)', () => {
    const lines = render(`graph TD
subgraph One
  A
end
subgraph Two
  B
end
A -->|x| B
B -->|y| A`)
    const col = strokeColumn(lines)
    const y = lines.findIndex((l) => l.includes('y'))
    const x = lines.findIndex((l) => l.includes('│ x'))
    // The label rows keep their stroke glyph and the title row is intact.
    expect(lines[y]![col]).toBe('│')
    expect(lines[x]![col]).toBe('│')
    expect(lines.some((l) => l.includes('Two'))).toBe(true)
  })

  it('falls back to the on-stroke placement when the left side has no room', () => {
    // `cancel` is wider than the cells left of the stroke in a 3-wide
    // channel, so beside-left would start off-canvas; it stays centred on the
    // stroke (the pre-#1284 placement) rather than being clipped.
    const lines = render(`stateDiagram-v2
  Idle --> Active : start
  Active --> Idle : cancel`)
    const col = strokeColumn(lines)
    const start = lines.find((l) => l.includes('cancel'))!.indexOf('cancel')
    expect(start).toBeGreaterThanOrEqual(0)
    expect(start).toBeLessThanOrEqual(col)
    expect(start + 'cancel'.length).toBeGreaterThan(col)
  })

  it('leaves a lone labelled vertical edge on its stroke (wider case deliberately not changed)', () => {
    const lines = render(`graph TD
A -->|hello| B`)
    const row = lines.find((l) => l.includes('hello'))!
    expect(row.trim()).toBe('hello')
  })
})
