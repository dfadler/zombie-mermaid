/**
 * #3140: the labels of a vertical reciprocal pair share the gap's middle row,
 * each on the outer side of its own stroke, as mermaid@12.3.0 draws them at one
 * height. Before, each label stood next to its own arrowhead (#530), so the two
 * sat on different rows.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (src: string): string[] =>
  renderMermaidASCII(src, { colorMode: 'none' }).split('\n')

const row = (lines: string[], text: string): number =>
  lines.findIndex((l) => l.includes(text))

describe('reciprocal pair labels share one row (#3140)', () => {
  it.each(['TD', 'BT'])('%s: go and back sit on one row', (dir) => {
    const lines = render(`graph ${dir}\nA -->|go| B\nB -->|back| A`)
    expect(row(lines, 'go')).toBe(row(lines, 'back'))
  })

  it('puts each label outside both strokes, a blank cell clear of its own', () => {
    const lines = render('graph TD\nA -->|go| B\nB -->|back| A')
    const r = lines[row(lines, 'go')]!
    const first = r.indexOf('│')
    const last = r.lastIndexOf('│')
    expect(first).toBeGreaterThan(-1)
    expect(last).toBeGreaterThan(first)
    // The up edge (`back`) takes the left stroke, the down edge (`go`) the right.
    expect(r.indexOf('back') + 'back'.length).toBeLessThan(first)
    expect(r.indexOf('go')).toBeGreaterThan(last)
  })

  it('keeps both strokes whole on every row between the nodes', () => {
    const lines = render('graph TD\nA -->|go| B\nB -->|back| A')
    const up = lines[row(lines, '▲')]!.indexOf('▲')
    const down = lines[row(lines, '▼')]!.indexOf('▼')
    for (let i = row(lines, '▲') + 1; i < row(lines, '▼'); i++) {
      expect(lines[i]![up]).toBe('│')
      expect(lines[i]![down]).toBe('│')
    }
  })

  it('leaves a pair with a multi-line label on the old placement', () => {
    const lines = render('graph TD\nA -->|"go<br/>now"| B\nB -->|back| A')
    expect(row(lines, 'go')).toBeGreaterThan(-1)
    expect(row(lines, 'back')).toBeGreaterThan(-1)
    expect(row(lines, 'now')).toBe(row(lines, 'go') + 1)
  })

  it('leaves a pair with one unlabelled edge on the old placement', () => {
    const lines = render('graph TD\nA --> B\nB -->|back| A')
    expect(row(lines, 'back')).toBeGreaterThan(-1)
  })

  it('keeps the old placement where a neighbouring stroke leaves no room beside', () => {
    // Six strokes two cells apart on A's bottom face: `long label` cannot sit
    // left of its stroke without covering the next one.
    const lines = render(
      'graph TD\nA -->|x| B\nB -->|long label| A\nA -->|long label| C\nC -->|ab| A',
    )
    const gap = lines.slice(row(lines, '▲'), row(lines, 'C'))
    expect(gap.join('\n')).toContain('long label')
    expect(gap.join('\n')).toContain('ab')
  })
})
