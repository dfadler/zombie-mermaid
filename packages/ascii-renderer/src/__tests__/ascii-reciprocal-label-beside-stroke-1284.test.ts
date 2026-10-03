/**
 * #1284: the two edges of a straight vertical reciprocal pair
 * (`A -->|x| B` + `B -->|y| A`) used to share one stroke, with both labels
 * drawn on it (`┼` / `y` / `│`). Each edge now has its own stroke, one cell
 * either side of the column centre (down edge right, up edge left), and its
 * label sits beside it, one blank cell clear.
 *
 * The row stays where #530 put it (see ascii-state-bidirectional-label-swap-530).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (src: string): string[] =>
  renderMermaidASCII(src, { colorMode: 'none' }).split('\n')

interface Strokes {
  up: number
  down: number
  upRow: number
  downRow: number
}

/** Columns and rows of the two arrowheads: where each stroke runs. */
function strokes(lines: string[]): Strokes {
  const upRow = lines.findIndex((l) => l.includes('▲'))
  const downRow = lines.findIndex((l) => l.includes('▼'))
  return {
    up: lines[upRow]!.indexOf('▲'),
    down: lines[downRow]!.indexOf('▼'),
    upRow,
    downRow,
  }
}

describe('reciprocal pair draws separate strokes with labels beside them (#1284)', () => {
  const PAIR = `graph TD
A -->|x| B
B -->|y| A`

  it('draws two strokes one blank column apart', () => {
    const { up, down } = strokes(render(PAIR))
    expect(down - up).toBe(2)
  })

  it('keeps both strokes unbroken on every row between the two nodes', () => {
    const lines = render(PAIR)
    const { up, down, upRow, downRow } = strokes(lines)
    for (let row = upRow + 1; row < downRow; row++) {
      expect(lines[row]![up], `up stroke, row ${row}: ${lines[row]}`).toBe('│')
      expect(lines[row]![down], `down stroke, row ${row}: ${lines[row]}`).toBe(
        '│',
      )
    }
  })

  it('puts the up edge label left of its stroke and the down edge label right of its own', () => {
    const lines = render(PAIR)
    const { up, down } = strokes(lines)
    const yRow = lines.find((l) => l.includes('y'))!
    const xRow = lines.find((l) => /\bx\b/.test(l))!
    expect(yRow.indexOf('y')).toBeLessThan(up - 1)
    expect(xRow.indexOf('x')).toBeGreaterThan(down + 1)
  })

  it('keeps the #530 row order: up label under the up arrowhead, down label above the down arrowhead', () => {
    const lines = render(PAIR)
    const { upRow, downRow } = strokes(lines)
    expect(lines.findIndex((l) => l.includes('y'))).toBe(upRow + 1)
    expect(lines.findIndex((l) => /\bx\b/.test(l))).toBe(downRow - 1)
  })

  it('leaves room for a long label without covering a stroke', () => {
    const lines = render(`stateDiagram-v2
  Idle --> Active : start
  Active --> Idle : cancel`)
    const { up, down, upRow, downRow } = strokes(lines)
    for (let row = upRow + 1; row < downRow; row++) {
      expect(lines[row]![up]).toBe('│')
      expect(lines[row]![down]).toBe('│')
    }
    const cancel = lines.find((l) => l.includes('cancel'))!
    expect(cancel.indexOf('cancel') + 'cancel'.length).toBeLessThan(up)
    expect(lines.find((l) => l.includes('start'))!.indexOf('start')).toBeGreaterThan(
      down,
    )
  })

  it('draws the strokes apart for an unlabelled pair too', () => {
    const { up, down } = strokes(render('graph TD\nA --> B\nB --> A'))
    expect(down - up).toBe(2)
  })

  it('keeps both strokes and the title whole between two frames (the issue repro)', () => {
    const lines = render(`graph TD
subgraph One
  A
end
subgraph Two
  B
end
A -->|x| B
B -->|y| A`)
    const { up, down, upRow, downRow } = strokes(lines)
    for (let row = upRow + 1; row < downRow; row++) {
      // A wall or title row may hold a frame glyph, but never a label.
      expect(lines[row]![up], `row ${row}: ${lines[row]}`).toMatch(/[│┼]/)
      expect(lines[row]![down], `row ${row}: ${lines[row]}`).toMatch(/[│┼]/)
    }
    expect(lines.some((l) => l.includes('Two'))).toBe(true)
  })

  it('leaves a lone labelled vertical edge on its stroke (wider case deliberately not changed)', () => {
    const lines = render(`graph TD
A -->|hello| B`)
    const row = lines.find((l) => l.includes('hello'))!
    expect(row.trim()).toBe('hello')
  })

  it('leaves a pair that is not one straight column alone', () => {
    // Side by side the pair already routes through lanes (#629).
    const lines = render(`graph LR
A -->|req| B
B -->|res| A`)
    expect(lines.some((l) => l.includes('▲') && l.includes('▼'))).toBe(false)
  })
})
