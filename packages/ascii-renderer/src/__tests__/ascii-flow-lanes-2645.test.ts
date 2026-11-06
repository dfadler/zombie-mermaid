/**
 * #2645: four or more edges between two stacked nodes take a port each on the
 * facing faces (the same cell on both), a Z of jogs out to lanes either side
 * of the group, and the label on the lane - as Mermaid draws them - instead
 * of looping round the right face.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../index.ts'

const render = (src: string, useAscii = false): string =>
  renderMermaidASCII(src, { colorMode: 'none', useAscii })
const edges = (labels: string[], from = 'A', to = 'B'): string =>
  labels.map((l) => `  ${from} -->|${l}| ${to}`).join('\n')

describe('TD same-pair groups on the flow faces (#2645)', () => {
  it('five parallel edges: five ports, lanes both sides, one head each', () => {
    const out = render(
      `flowchart TD\n${edges(['first', 'second', 'third', 'fourth', 'fifth'])}`,
    )
    expect(out).toBe(
      [
        '          ┌─────────┐           ',
        '          │         │           ',
        '          │    A    │           ',
        '          │         │           ',
        '          └┬─┬─┬─┬─┬┘           ',
        '           │ │ │ │ │            ',
        '  ┌────────┘ │ │ │ └────────┐   ',
        '  │      ┌───┘ │ └────┐     │   ',
        'first second third fourth fifth ',
        '  │      └───┐ │ ┌────┘     │   ',
        '  └────────┐ │ │ │ ┌────────┘   ',
        '           │ │ │ │ │            ',
        '           ▼ ▼ ▼ ▼ ▼            ',
        '          ┌─────────┐           ',
        '          │         │           ',
        '          │    B    │           ',
        '          │         │           ',
        '          └─────────┘           ',
      ].join('\n'),
    )
  })

  it('forward and back edges share one port order on both faces', () => {
    const out = render(
      `flowchart TD\n${edges(['f1', 'f2', 'f3', 'f4'])}\n${edges(['b1', 'b2'], 'B', 'A')}`,
    )
    expect(out).toBe(
      [
        '    ┌───────────┐    ',
        '    │           │    ',
        '    │     A     │    ',
        '    │           │    ',
        '    └┬─┬─┬─┬────┘    ',
        '     │ │ │ │ ▲ ▲     ',
        ' ┌───┘ │ │ │ │ └───┐ ',
        ' │  ┌──┘ │ │ └──┐  │ ',
        'f1 f2   f3 │   b1 b2 ',
        ' │  │    │f4    │  │ ',
        ' │  └──┐ │ │ ┌──┘  │ ',
        ' └───┐ │ │ │ │ ┌───┘ ',
        '     │ │ │ │ │ │     ',
        '     ▼ ▼ ▼ ▼ │ │     ',
        '    ┌────────┴─┴┐    ',
        '    │           │    ',
        '    │     B     │    ',
        '    │           │    ',
        '    └───────────┘    ',
      ].join('\n'),
    )
  })

  it('draws the ASCII charset and BT with the same shape', () => {
    const src = (dir: string): string =>
      `flowchart ${dir}\n${edges(['one', 'two', 'three', 'four'])}`
    const ascii = render(src('TD'), true)
    expect(ascii.match(/v/g)).toHaveLength(4)
    expect(ascii).not.toMatch(/[│┌]/)
    const bt = render(src('BT'))
    expect(bt.match(/▲/g)).toHaveLength(4)
    expect(bt.indexOf('B')).toBeLessThan(bt.indexOf('A'))
  })

  it('keeps every label and every head when labels are tall or missing', () => {
    const tall = render(
      `flowchart TD\n${edges(['one<br>two', 'second', 'third', 'fourth'])}`,
    )
    for (const t of ['one', 'two', 'second', 'third', 'fourth']) {
      expect(tall).toContain(t)
    }
    expect(tall.match(/▼/g)).toHaveLength(4)
    const bare = render(`flowchart TD\n${edges(['', '', '', '', ''])}`)
    expect(bare.match(/▼/g)).toHaveLength(5)
  })

  it('leaves a group with another edge on its faces as before', () => {
    const sibling = render(
      `flowchart TD\n${edges(['first', 'second', 'third', 'fourth'])}\n  A --> C`,
    )
    expect(sibling).not.toMatch(/┬─┬─┬/)
    const framed = render(
      `flowchart TD\n  subgraph S\n    A\n    B\n  end\n${edges(['first', 'second', 'third', 'fourth'])}`,
    )
    expect(framed).not.toMatch(/└┬─┬─┬/)
    const apart = render(
      `flowchart TD\n${edges(['first', 'second', 'third', 'fourth'])}\n  B --> C\n  A --> D\n  D --> C`,
    )
    expect(apart).toContain('first')
    const selfLoop = render(
      `flowchart TD\n${edges(['first', 'second', 'third', 'fourth'])}\n  A --> A`,
    )
    expect(selfLoop).toContain('first')
    const beside = render(
      `flowchart TD\n${edges(['first', 'second', 'third', 'fourth'])}\n  X --> Y`,
    )
    expect(beside).toContain('first')
  })

  it('takes the flow faces for three labels too wide to sit beside their strokes (#2736)', () => {
    const three = render(`flowchart TD\n${edges(['first', 'second', 'third'])}`)
    expect(three).not.toContain('◄')
    expect(three).toMatch(/first +second +third/)
    expect(three.match(/▼/g)).toHaveLength(3)
  })

  it('keeps each line style on its own stroke', () => {
    const out = render(
      'flowchart TD\n  A -->|first| B\n  A -.->|second| B\n  A ==>|third| B\n  A -->|fourth| B',
    )
    expect(out).toContain('┆')
    expect(out).toContain('┃')
    expect(out.match(/▼/g)).toHaveLength(4)
  })

  it('draws a group with a node above and below it', () => {
    const out = render(
      `flowchart TD\n  S --> A\n${edges(['first', 'second', 'third', 'fourth'])}\n  B --> E`,
    )
    expect(out.match(/▼/g)).toHaveLength(6)
    expect(out).toContain('fourth')
  })
})
