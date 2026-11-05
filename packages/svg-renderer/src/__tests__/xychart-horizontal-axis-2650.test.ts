/**
 * #2650: a horizontal xychart draws its value axis along the top, and both
 * orientations inset the first and last category by the axis' outer padding.
 * Reference figures are fractions of the plot measured in mermaid 12.3.0's
 * render of `x-axis [a, b, c]`, `bar [10, 80, 30]` (headless Chromium):
 * horizontal, category centres at 0.1114 / 0.5 / 0.8886 and bars 0.2116
 * thick; vertical, 0.1141 / 0.5 / 0.8859 and 0.2165.
 */
import { describe, it, expect } from 'vitest'
import { parseXYChart } from '@zombie-mermaid/mermaid-parser'
import { splitStatements } from '@zombie-mermaid/core'
import { renderMermaidSVG } from '../index.ts'
import { layoutXYChart } from '../xychart/layout.ts'

const layout = (src: string) =>
  layoutXYChart(parseXYChart(splitStatements(src)))

const BODY = `x-axis [a, b, c]
    y-axis "v" 0 --> 100
    bar [10, 80, 30]`

describe('horizontal xychart value axis (#2650)', () => {
  const l = layout(`xychart-beta horizontal\n title "T"\n ${BODY}`)
  const { plotArea: p } = l

  it('puts the value axis line, ticks and labels above the plot', () => {
    expect(l.xAxis.line.y1).toBe(p.y)
    expect(l.xAxis.line.y2).toBe(p.y)
    for (const t of l.xAxis.ticks) {
      expect(t.y).toBe(p.y)
      expect(t.ty).toBeLessThan(p.y)
      expect(t.labelY).toBeLessThan(t.ty)
    }
  })

  it('keeps the category axis on the left, top to bottom', () => {
    expect(l.yAxis.line.x1).toBe(p.x)
    const ys = l.yAxis.ticks.map((t) => t.y)
    expect(ys).toEqual([...ys].sort((a, b) => a - b))
    expect(l.yAxis.ticks.map((t) => t.label)).toEqual(['a', 'b', 'c'])
  })

  it('stacks the chart title, the value-axis title and the labels above the plot', () => {
    expect(l.title!.y).toBeLessThan(l.xAxis.title!.y)
    expect(l.xAxis.title!.y).toBeLessThan(l.xAxis.ticks[0]!.labelY)
    expect(l.xAxis.ticks[0]!.labelY).toBeLessThan(p.y)
    // Nothing is left below the plot but the padding.
    expect(l.height - (p.y + p.height)).toBe(22)
  })

  it('draws the axis path from the bottom-left corner up and across the top', () => {
    const svg = renderMermaidSVG(`xychart-beta horizontal\n ${BODY}`)
    expect(svg).toMatch(
      /<path d="M[\d.]+,([\d.]+) V([\d.]+) H[\d.]+" class="xychart-axis"\/>/,
    )
    const [, bottom, top] = svg.match(
      /<path d="M[\d.]+,([\d.]+) V([\d.]+) H[\d.]+" class="xychart-axis"\/>/,
    )!
    expect(Number(top)).toBeLessThan(Number(bottom))
  })
})

describe('category-axis inset (#2650)', () => {
  it('insets horizontal categories like mermaid 12.3.0', () => {
    const l = layout(`xychart-beta horizontal\n ${BODY}`)
    const { y, height } = l.plotArea
    const f = l.yAxis.ticks.map((t) => (t.y - y) / height)
    expect(f[0]).toBeCloseTo(0.1114, 2)
    expect(f[1]).toBeCloseTo(0.5, 3)
    expect(f[2]).toBeCloseTo(0.8886, 2)
    expect(l.bars[0]!.height / height).toBeCloseTo(0.2116, 2)
    // Bars sit on their category.
    expect(l.bars[0]!.y + l.bars[0]!.height / 2).toBeCloseTo(
      l.yAxis.ticks[0]!.y,
    )
  })

  it('insets vertical categories like mermaid 12.3.0', () => {
    const l = layout(`xychart-beta\n ${BODY}`)
    const { x, width } = l.plotArea
    const f = l.xAxis.ticks.map((t) => (t.x - x) / width)
    expect(f[0]).toBeCloseTo(0.1141, 2)
    expect(f[1]).toBeCloseTo(0.5, 3)
    expect(f[2]).toBeCloseTo(0.8859, 2)
    expect(l.bars[0]!.width / width).toBeCloseTo(0.2165, 2)
  })

  it('insets line-only categories by the label padding alone, centres one category', () => {
    const l = layout('xychart-beta\n x-axis [a, b, c]\n line [1, 3, 2]')
    const f = (l.xAxis.ticks[0]!.x - l.plotArea.x) / l.plotArea.width
    expect(f).toBeGreaterThan(0)
    expect(f).toBeLessThan(0.03)
    const one = layout('xychart-beta\n x-axis [a]\n bar [1]')
    expect(one.xAxis.ticks[0]!.x).toBeCloseTo(
      one.plotArea.x + one.plotArea.width / 2,
    )
  })
})
