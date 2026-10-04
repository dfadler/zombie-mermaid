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

/** The column of the first arrowhead: where a single shared stroke runs. */
function strokeColumn(lines: string[]): number {
  const arrow = lines.findIndex((l) => l.includes('▲'))
  return lines[arrow]!.indexOf('▲')
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
    expect(
      lines.find((l) => l.includes('start'))!.indexOf('start'),
    ).toBeGreaterThan(down)
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

  it('fits a long up-edge label whole beside its stroke by widening the channel', () => {
    // A label wider than the default room left of the stroke: the pair's
    // channel is widened for it (edge-routing.ts, #1284), so the label lands
    // whole beside the stroke, never clipped at the canvas edge and never
    // cutting through the stroke.
    const label = 'cancel the whole thing'
    const lines = render(`stateDiagram-v2
  Idle --> Active : start
  Active --> Idle : ${label}`)
    const col = strokeColumn(lines)
    const start = lines.find((l) => l.includes(label))!.indexOf(label)
    expect(start).toBeGreaterThanOrEqual(0)
    expect(start + label.length).toBeLessThan(col)
  })

  it('puts a lone labelled down edge right of its stroke too', () => {
    const lines = render(`graph TD
A -->|hello| B`)
    const col = lines[lines.findIndex((l) => l.includes('▼'))]!.indexOf('▼')
    const row = lines.find((l) => l.includes('hello'))!
    expect(row[col]).toBe('│')
    expect(row.indexOf('hello')).toBe(col + 2)
  })

  it('keeps a lone down edge on its stroke when another edge blocks the right side', () => {
    // The sibling A --> C runs where a beside-right label would land, so the
    // free-cell check fails and the label stays centred on its own stroke.
    const lines = render(`graph TD
A -->|a much longer label here| B
A --> C`)
    const col = lines[lines.findIndex((l) => l.includes('▼'))]!.indexOf('▼')
    const start = lines
      .find((l) => l.includes('a much longer'))!
      .indexOf('a much longer')
    expect(start).toBeLessThanOrEqual(col)
    expect(start + 'a much longer label here'.length).toBeGreaterThan(col)
  })

  it('leaves a pair that is not one straight column alone', () => {
    // Side by side the pair already routes through lanes (#629).
    const lines = render(`graph LR
A -->|req| B
B -->|res| A`)
    expect(lines.some((l) => l.includes('▲') && l.includes('▼'))).toBe(false)
  })

  it('draws the strokes apart when only one edge of the pair is labelled', () => {
    const lines = render(`graph TD
A --> B
B -->|y| A`)
    const { up, down } = strokes(lines)
    expect(down - up).toBe(2)
    expect(lines.find((l) => l.includes('y'))!.indexOf('y')).toBeLessThan(
      up - 1,
    )
  })

  it.each([
    ['round', 'A((a)) -->|x| B((b))'],
    ['diamond', 'A{a} -->|x| B{b}'],
    ['stadium', 'A([a]) -->|x| B([b])'],
  ])('draws two strokes between %s nodes', (_shape, first) => {
    const lines = render(`graph TD
${first}
B -->|y| A`)
    const { up, down } = strokes(lines)
    expect(down - up).toBe(2)
  })

  it('draws two strokes through nested frames without a label on a frame glyph', () => {
    const lines = render(`graph TD
subgraph O
  subgraph I
    A
  end
end
subgraph P
  B
end
A -->|x| B
B -->|y| A`)
    const { up, down, upRow, downRow } = strokes(lines)
    expect(down - up).toBe(2)
    for (let row = upRow + 1; row < downRow; row++) {
      expect(lines[row]![up], `row ${row}: ${lines[row]}`).toMatch(/[│┼]/)
      expect(lines[row]![down], `row ${row}: ${lines[row]}`).toMatch(/[│┼]/)
    }
  })

  it('leaves a pair whose edges bend alone (the path is not two points)', () => {
    const text = render(`graph TD
A --> C
A -->|x| B
B -->|y| A
C --> D
B --> D`).join('\n')
    // Both labels still drawn whole, and no up-arrowhead stroke beside a down one.
    expect(text).toMatch(/\bx\b/)
    expect(text).toMatch(/\by\b/)
    expect(text).not.toContain('▲')
  })

  it('leaves a pair that exits a frame alone (cluster-exit edges are excluded)', () => {
    const lines = render(`graph TD
subgraph S
  A
  A2
end
A -->|x| B
B -->|y| A
A2 --> B`)
    const { up, down } = strokes(lines)
    expect(Math.abs(down - up)).not.toBe(2)
    expect(lines.some((l) => l.includes('x'))).toBe(true)
    expect(lines.some((l) => l.includes('y'))).toBe(true)
  })
})
