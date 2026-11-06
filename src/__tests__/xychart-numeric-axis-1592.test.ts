/**
 * #1592: a numeric x-axis range is a linear axis, as in mermaid 12.2.0 (the pin
 * and npm latest when written): a label at every d3 tick of the range and each
 * series spread over [min, max] by value, not laid out as categories. The
 * ASCII renderer has its own layout: vertical charts label every tick too
 * (#2553); horizontal ones still draw the data points only. Its snapshots pin
 * that.
 */
// Provenance (#2679): the .snap is this renderer's own output, accepted once when the test was written. It does not claim to match mermaid.js.
import { describe, expect, it } from 'vitest'
import { layoutXYChart } from '@zombie-mermaid/svg-renderer'
import { parseXYChart } from '@zombie-mermaid/mermaid-parser'
import { splitStatements } from '@zombie-mermaid/core'
import { renderMermaidASCII, renderMermaidSVG } from '../index.ts'

const CASES: [string, string][] = [
  ['line 0..9', 'x-axis 0 --> 9\n line [1,5,3,8]'],
  ['horizontal line 0..9', 'horizontal|x-axis 0 --> 9\n line [1,5,3,8]'],
  ['bars 0..100', 'x-axis 0 --> 100\n bar [10,20,30,40,50]'],
  [
    'horizontal bars 0..100',
    'horizontal|x-axis 0 --> 100\n bar [10,20,30,40,50]',
  ],
  [
    'bar and line 2020..2024',
    'x-axis 2020 --> 2024\n bar [3,5,2]\n line [4,1,6]',
  ],
  ['ticks short of the end', 'x-axis 0 --> 95\n bar [4,8,6,9,2,7,5]'],
  ['single point', 'x-axis 0 --> 10\n y-axis 0 --> 10\n bar [5]'],
]
const src = (body: string): string =>
  body.startsWith('horizontal|')
    ? `xychart-beta horizontal\n ${body.slice(11)}`
    : `xychart-beta\n ${body}`
const layout = (body: string) =>
  layoutXYChart(parseXYChart(splitStatements(src(body))))

describe('numeric x-axis range (#1592)', () => {
  it.each(CASES)('SVG: %s', (_name, body) => {
    expect(renderMermaidSVG(src(body))).toMatchSnapshot()
  })

  it.each(CASES)('ASCII: %s', (_name, body) => {
    expect(renderMermaidASCII(src(body))).toMatchSnapshot()
  })

  it('labels every tick of the range and spans the axis ends', () => {
    const c = layout('x-axis 0 --> 9\n line [1,5,3,8]')
    expect(c.xAxis.ticks.map((t) => t.label)).toEqual(
      Array.from({ length: 10 }, (_, i) => String(i)),
    )
    const xs = c.lines[0]!.points.map((p) => p.x)
    // First and last points sit on the first and last tick (same padding)
    expect(xs[0]).toBeCloseTo(c.xAxis.ticks[0]!.x)
    expect(xs[3]).toBeCloseTo(c.xAxis.ticks[9]!.x)
    expect(xs[1]! - xs[0]!).toBeCloseTo(xs[2]! - xs[1]!)
  })

  it('uses the d3 tick step: 10 for 0..100, 0.5 for 2020..2024', () => {
    const a = layout('x-axis 0 --> 100\n bar [10,20,30,40,50]')
    expect(a.xAxis.ticks.map((t) => t.label).slice(0, 3)).toEqual([
      '0',
      '10',
      '20',
    ])
    const b = layout('x-axis 2020 --> 2024\n bar [3,5,2]')
    expect(b.xAxis.ticks.map((t) => t.label).slice(0, 3)).toEqual([
      '2020',
      '2020.5',
      '2021',
    ])
  })

  it('runs a horizontal range from the bottom up, as mermaid does', () => {
    const c = layout('horizontal|x-axis 0 --> 9\n line [1,5,3,8]')
    const ys = c.yAxis.ticks.map((t) => t.y)
    expect(c.yAxis.ticks[0]!.label).toBe('0')
    expect(ys[0]).toBeGreaterThan(ys[9]!)
    const pts = c.lines[0]!.points
    expect(pts[0]!.y).toBeGreaterThan(pts[3]!.y)
  })

  it('places a series by its own length over the shared range', () => {
    const c = layout('x-axis 0 --> 20\n line [1,2,3,4,5]\n line [5,1,4]')
    const [a, b] = c.lines
    expect(a!.points[4]!.x).toBeCloseTo(b!.points[2]!.x)
    expect(a!.points[2]!.x).toBeCloseTo(b!.points[1]!.x)
  })

  it('centres every point of a degenerate range', () => {
    const c = layout('x-axis 3 --> 3\n line [1,2]')
    const [p, q] = c.lines[0]!.points
    expect(p!.x).toBeCloseTo(q!.x)
  })

  it('bars are as thick as mermaid draws them and sit on their value', () => {
    const c = layout('x-axis 0 --> 100\n bar [10,20,30,40,50]')
    const [first, last] = [c.bars[0]!, c.bars[4]!]
    const tick = c.xAxis.ticks
    expect(first.x + first.width / 2).toBeCloseTo(tick[0]!.x)
    expect(last.x + last.width / 2).toBeCloseTo(tick[10]!.x)
    expect(first.width).toBeGreaterThan(0)
    expect(first.width).toBeLessThan(tick[1]!.x - tick[0]!.x)
  })

  it('ASCII labels the single tick of a degenerate range (#2553)', () => {
    const out = renderMermaidASCII(
      'xychart-beta\n  x-axis 5 --> 5\n  bar [3, 4]',
    )
    const axisRow = out.split('\n').filter((l) => l.trim() === '5')
    expect(axisRow).toHaveLength(1)
  })
})
