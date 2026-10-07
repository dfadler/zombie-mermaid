/**
 * #1408 option C: a vertical edge's label is drawn ON its stroke, centred on
 * the stroke column at the gap midpoint, with the stroke carrying on above and
 * below it. When the gap is too short, or the cells around it are taken, the
 * previous placement stands.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (src: string): string[] =>
  renderMermaidASCII(src, { colorMode: 'none' }).split('\n')

describe('vertical edge label on its stroke (#1408)', () => {
  it('centres a lone label on the stroke at the gap midpoint', () => {
    const lines = render('graph TD\nA -->|push = build| B')
    const bottom = lines.findIndex((l) => l.includes('└'))
    const top = lines.findIndex((l, i) => i > bottom && l.includes('┌'))
    const row = lines.findIndex((l) => l.includes('push = build'))
    expect(row).toBe(bottom + Math.floor((top - bottom) / 2))
    const col = lines[bottom]!.indexOf('┬')
    const text = lines[row]!
    const start = text.indexOf('push = build')
    expect(start + Math.floor('push = build'.length / 2)).toBe(col)
    // The stroke runs unbroken above and below the label row.
    expect(lines[row - 1]![col]).toBe('│')
    expect(lines[row + 1]![col]).toBe('│')
  })

  it('puts fan-out labels on their own branches', () => {
    const lines = render('graph TD\nA -->|x| B\nA -->|yy| C\nA -->|zzz| D')
    for (const label of ['x', 'yy', 'zzz']) {
      const row = lines.findIndex((l) => new RegExp(`\\b${label}\\b`).test(l))
      const mid = lines[row]!.indexOf(label) + Math.floor(label.length / 2)
      expect(lines[row - 1]![mid]).toBe('│')
      expect(lines[row + 1]![mid]).toBe('│')
    }
  })

  it('keeps one plain stroke cell between a two-line label and the arrowhead', () => {
    const lines = render('graph TD\nA -->|"one<br/>two"| B')
    const row = lines.findIndex((l) => l.includes('two'))
    const col = lines[row]!.indexOf('two') + 1
    expect(lines[row + 1]![col]).toBe('│')
    expect(lines[row + 2]![col]).toBe('▼')
  })

  it('falls back when the gap is too short, leaving the bypass junction whole', () => {
    const lines = render('graph TD\nA-->B\nB-->|"E-mail System"|C\nA-->C')
    const row = lines.findIndex((l) => l.includes('E-mail System'))
    expect(lines[row + 1]).toMatch(/├─+┘/)
  })

  it('leaves a reciprocal pair with wide labels beside its strokes', () => {
    const lines = render('graph TD\nA -->|down| B\nB -->|up| A')
    const down = lines.findIndex((l) => l.includes('down'))
    const arrow = lines.find((l) => l.includes('▼'))!.indexOf('▼')
    expect(lines[down]!.indexOf('down')).toBeGreaterThan(arrow)
  })

  it('puts narrow reciprocal labels on their own strokes', () => {
    const lines = render('graph TD\nA -->|x| B\nB -->|y| A')
    const up = lines.find((l) => l.includes('▲'))!.indexOf('▲')
    const down = lines.find((l) => l.includes('▼'))!.indexOf('▼')
    expect(lines.find((l) => /\by\b/.test(l))![up]).toBe('y')
    expect(lines.find((l) => /\bx\b/.test(l))![down]).toBe('x')
  })
})
