/**
 * #2678 (general-116): a far same-pair group whose ends sit on different rows
 * used to push its second lane through the source's own face and round the whole
 * diagram, so its label sat at the bottom and entered the target by a detour.
 * Every lane now takes the hinted Z, as mermaid@12.3.0 draws it: all of
 * fifth/sixth over the top, in the order of its ports.
 */
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '../src/index.ts'

const FAN_IN = `A --> B
  A -->|first| C
  B -->|second| C
  A -->|third| D
  C -->|fourth| D
  B -->|fifth| D
  B -->|sixth| D
  A -->|seventh| D`

const render = (head: string, body = FAN_IN): string[] =>
  renderMermaidASCII(`${head}\n  ${body}`, { colorMode: 'none' }).split('\n')
const rowOf = (lines: string[], label: string): number =>
  lines.findIndex((l) => l.includes(label))

describe('hinted Z lanes (#2678)', () => {
  it('LR: labels read in mermaid order and sixth stays above A', () => {
    const lines = render('flowchart LR')
    const rows = ['fifth', 'sixth', 'fourth', 'third', 'seventh'].map((l) =>
      rowOf(lines, l),
    )
    expect(rows).toEqual([...rows].sort((a, b) => a - b))
    expect(new Set(rows).size).toBe(5)
    // mermaid@12.3.0 has sixth over the top, next to fifth, not under A.
    expect(rowOf(lines, 'sixth')).toBeLessThan(rowOf(lines, ' A '))
  })

  it('LR: all five edges enter D by its left face', () => {
    const lines = render('flowchart LR')
    expect(lines.filter((l) => /►│[ D]+│\s*$/.test(l))).toHaveLength(5)
    expect(lines.join('\n')).not.toMatch(/▲/)
    // No lane runs under A: the diagram ends at A's bottom edge.
    expect(lines.findLastIndex((l) => /\S/.test(l))).toBeLessThanOrEqual(
      lines.findLastIndex((l) => l.includes('└───┘')) + 1,
    )
  })

  it('TD: the five edges enter D by its top face, one arrowhead each', () => {
    const lines = render('flowchart TD')
    // Each lane's arrowhead has a cell of its own, with a gap between.
    expect(lines.filter((l) => /▼ ▼ ▼ ▼ ▼/.test(l))).toHaveLength(1)
    for (const label of ['fifth', 'sixth', 'seventh'])
      expect(lines.join('\n')).toContain(label)
  })

  it('keeps a lane group that ends on a decision as before', () => {
    const lines = render(
      'flowchart LR',
      `A --> B
  A --> C
  B --> D{D?}
  B -->|x| D
  B -->|y| D
  C --> D`,
    )
    for (const label of [' x ', ' y '])
      expect(lines.filter((l) => l.includes(label))).toHaveLength(1)
  })

  it('draws the labels of a cluster exit group once each', () => {
    const lines = render(
      'flowchart LR',
      `subgraph S
    a --> b
  end
  b -->|one| c
  b -->|two| c
  S -->|three| d
  S -->|four| d
  c --> d`,
    )
    const out = lines.join('\n')
    for (const label of ['one', 'two', 'three', 'four'])
      expect(out.match(new RegExp(label, 'g'))).toHaveLength(1)
  })
})
