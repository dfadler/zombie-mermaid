/**
 * #2932 / #3008: flowchart labels wrap at 120px and every shape's size follows
 * the label box, as in mermaid@12.3.0 (headless, `scripts/lib/real-mermaid.ts`).
 */
import { describe, it, expect } from 'vitest'
import { layoutFlowchartSync } from '@zombie-mermaid/svg-renderer'
import { renderMermaidSVG } from '../src/index.ts'
import { parseMermaid } from '../src/index.ts'

// Four lines at mermaid's 120px wrap (measured, mermaid@12.3.0; our Inter metrics
// break a label of narrower words differently from its trebuchet fallback).
const W = 'Authenticate every single incoming request now'
const TWO = 'line one<br/>line two'

function size(open: string, close: string, label: string) {
  const g = layoutFlowchartSync(
    parseMermaid(`flowchart TD\nA${open}"${label}"${close}`),
    // renderMermaidSVG draws flowchart labels at mermaid's 16px.
    { fontSizes: { nodeLabel: 16 } },
  )
  const n = g.nodes[0]!
  return { w: n.width, h: n.height }
}

// [open, close, label, mermaid@12.3.0 width, height]
const CASES: [string, string, string, number, number][] = [
  ['(', ')', TWO, 150, 78],
  ['[(', ')]', TWO, 144, 112.1],
  ['{{', '}}', TWO, 219.4, 118],
  ['((', '))', TWO, 107.6, 107.6],
  ['([', '])', TWO, 178.3, 72],
  ['(', ')', W, 150, 126],
  ['[(', ')]', W, 144, 160.1],
  ['{{', '}}', W, 246.9, 166],
  ['((', '))', W, 185.7, 185.7],
  ['([', '])', W, 208, 120],
]

describe('flowchart node sizes (#3008)', () => {
  it.each(CASES)('%s%s %j', (open, close, label, w, h) => {
    // The two-line circle is as wide as our font's text, not trebuchet's.
    const tol = open === '((' && label === TWO ? 6 : 0.2
    const s = size(open, close, label)
    expect(Math.abs(s.w - w)).toBeLessThan(tol)
    expect(Math.abs(s.h - h)).toBeLessThan(tol)
  })

  it('sizes a one-line cylinder, rounded and hexagon node to their label box', () => {
    expect(size('(', ')', 'ab')).toEqual({ w: 150, h: 54 })
    expect(size('[(', ')]', 'ab')).toEqual({ w: 144, h: 88.1 })
    expect(size('{{', '}}', 'ab').h).toBe(94)
    expect(size('{{', '}}', 'ab').w).toBeCloseTo(205.7, 1)
  })

  it('sizes a one-line circle near mermaid’s 61.6', () => {
    expect(Math.abs(size('((', '))', 'ab').w - 61.6)).toBeLessThan(4)
  })
})

describe('flowchart tall stadium and double circle (#3008)', () => {
  const lines = (n: number) => Array(n).fill('xx').join('<br/>')

  it('grows a stadium 36px a line past six lines, as mermaid@12.3.0 does', () => {
    expect(size('([', '])', lines(8)).w).toBeCloseTo(324, 1)
    expect(size('([', '])', lines(8)).h).toBe(216)
  })

  it('sizes a double circle from its label box (mermaid@12.3.0: 106.6 at two lines)', () => {
    expect(Math.abs(size('(((', ')))', lines(2)).w - 106.6)).toBeLessThan(6)
  })
})

describe('flowchart label wrapping (#2932)', () => {
  it('wraps "Process data now" onto two lines, as mermaid does', () => {
    const svg = renderMermaidSVG('flowchart TD\nA[Process data now]')
    expect(svg.match(/<tspan/g)).toHaveLength(2)
    expect(size('[', ']', 'Process data now')).toEqual({ w: 152, h: 72 })
  })

  it('does not wrap a state diagram label', () => {
    const svg = renderMermaidSVG(
      'stateDiagram-v2\n  state "Process data now" as A\n  [*] --> A',
    )
    expect(svg).toContain('>Process data now</text>')
  })
})
