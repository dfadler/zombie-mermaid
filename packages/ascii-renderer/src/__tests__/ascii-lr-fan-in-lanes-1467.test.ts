/**
 * #1467: in an LR flowchart, labeled edges into one node used to share one
 * lane and one final drop, so a label could not be tied to its edge. Once a
 * run already carries two labels, a further labeled edge now takes its own lane.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const SRC = `flowchart LR
  A --> B
  A -->|first| C
  B -->|second| C
  A -->|third| D
  C -->|fourth| D
  B -->|fifth| D
  B -->|sixth| D
  A -->|seventh| D`

describe('LR labeled fan-in lanes (#1467)', () => {
  const lines = renderMermaidASCII(SRC, { colorMode: 'none' }).split('\n')

  it('puts sixth and seventh on their own, distinct lane rows', () => {
    const sixth = lines.findIndex((l) => l.includes('sixth'))
    const seventh = lines.findIndex((l) => l.includes('seventh'))
    expect(sixth).not.toBe(seventh)
    for (const i of [sixth, seventh]) {
      // exactly one label on the row: nothing else shares the lane
      expect(lines[i]!.match(/[a-z]{4,}/g)).toHaveLength(1)
    }
  })

  it('draws seventh on the lane it labels, not hung under a shared one', () => {
    expect(lines.find((l) => l.includes('seventh'))).toMatch(/─seventh─/)
  })

  it('draws every label once', () => {
    const out = lines.join('\n')
    for (const w of [
      'first',
      'second',
      'third',
      'fourth',
      'fifth',
      'sixth',
      'seventh',
    ])
      expect(out.match(new RegExp(w, 'g'))).toHaveLength(1)
  })

  it('SVG still carries all seven labels as separate edges', () => {
    const svg = renderMermaidSVG(SRC)
    for (const w of [
      'first',
      'second',
      'third',
      'fourth',
      'fifth',
      'sixth',
      'seventh',
    ])
      expect(svg).toContain(w)
  })
})
