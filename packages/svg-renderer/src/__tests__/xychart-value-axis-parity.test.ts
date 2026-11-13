/**
 * Value axis and x labels as mermaid 12.2.0 draws them (#2567): padding below
 * the lowest tick, one tick for flat data, every category labelled.
 */
import { describe, it, expect } from 'vitest'
import { parseXYChart } from '@zombie-mermaid/mermaid-parser'
import { splitStatements } from '@zombie-mermaid/core'
import { layoutXYChart } from '../xychart/layout.ts'

const layout = (src: string) =>
  layoutXYChart(parseXYChart(splitStatements(src)))

describe('value axis padding', () => {
  it('keeps the smallest bar visible, reaching down to the axis line', () => {
    const l = layout('xychart-beta\n x-axis [a, b, c]\n bar [10, 20, 30]')
    const small = l.bars[0]!
    expect(small.height).toBeCloseTo(8, 5)
    expect(small.y + small.height).toBe(l.plotArea.y + l.plotArea.height)
  })

  it('insets the lowest and highest tick from the axis line by half a label', () => {
    const l = layout('xychart-beta\n x-axis [a, b]\n line [10, 30]')
    const [first, last] = [l.yAxis.ticks[0]!, l.yAxis.ticks.at(-1)!]
    expect(l.plotArea.y + l.plotArea.height - first.y).toBeCloseTo(8, 5)
    expect(last.y - l.plotArea.y).toBeCloseTo(8, 5)
  })

  it('insets horizontal charts at the value start, by half the widest label', () => {
    const l = layout(
      'xychart-beta horizontal\n x-axis [a, b]\n bar [100000, 220000]',
    )
    const bar = l.bars[0]!
    expect(bar.x).toBe(l.plotArea.x)
    expect(bar.width).toBeGreaterThan(10)
  })
})

describe('flat data', () => {
  it.each([
    ['bar [42]', ['42']],
    ['bar [0, 0, 0]', ['0']],
    ['line [50, 50]', ['50']],
  ])('%s has the single tick %j in the middle of the axis', (data, labels) => {
    const l = layout(`xychart-beta\n x-axis [a, b, c]\n ${data}`)
    expect(l.yAxis.ticks.map((t) => t.label)).toEqual(labels)
    expect(l.yAxis.ticks[0]!.y).toBeCloseTo(
      l.plotArea.y + l.plotArea.height / 2,
      5,
    )
  })
})

describe('flat negative data (#2772)', () => {
  // Mermaid 12.3.0 draws flat -5, 0 and 5 alike: bars from the mid-axis tick
  // down to the axis start. Zero is off the plot, so it is not the base.
  it.each(['-5', '0', '5'])('vertical bar [%s] reaches the axis start', (v) => {
    const l = layout(`xychart-beta\n x-axis [a, b]\n bar [${v}, ${v}]`)
    const bar = l.bars[0]!
    expect(bar.height).toBeGreaterThan(10)
    expect(bar.y + bar.height).toBe(l.plotArea.y + l.plotArea.height)
  })

  it.each(['-5', '5'])('horizontal bar [%s] starts at the axis start', (v) => {
    const l = layout(
      `xychart-beta horizontal\n x-axis [a, b]\n bar [${v}, ${v}]`,
    )
    expect(l.bars[0]!.x).toBe(l.plotArea.x)
    expect(l.bars[0]!.width).toBeGreaterThan(10)
  })
})

describe('x labels', () => {
  it('labels all 20 dense categories', () => {
    const cats = Array.from({ length: 20 }, (_, i) => `W${i + 1}`)
    const l = layout(
      `xychart-beta\n x-axis [${cats.join(', ')}]\n bar [${cats.map(() => 1).join(', ')}]`,
    )
    expect(l.xAxis.ticks.map((t) => t.label)).toEqual(cats)
  })
})

describe('negative and mixed-sign bars (#2880)', () => {
  // Mermaid 12.3.0 draws every bar from the start of the plot (bottom, or the
  // left edge when horizontal) to the value, never from zero: `bar [-5, 5]` is
  // a stub next to a full-height bar, `bar [-2, -5, -8]` three steps down.
  it('vertical [-5, 5]: the -5 bar is the 8px stub, the 5 bar spans the plot', () => {
    const l = layout('xychart-beta\n x-axis [a, b]\n bar [-5, 5]')
    const [lo, hi] = [l.bars[0]!, l.bars[1]!]
    const bottom = l.plotArea.y + l.plotArea.height
    expect(lo.y + lo.height).toBe(bottom)
    expect(lo.height).toBeCloseTo(8, 5)
    expect(hi.y + hi.height).toBe(bottom)
    expect(hi.y).toBeCloseTo(l.plotArea.y + 8, 5)
  })

  it('vertical [-2, -5, -8]: heights fall linearly from the plot top', () => {
    const l = layout('xychart-beta\n x-axis [a, b, c]\n bar [-2, -5, -8]')
    const [a, b, c] = l.bars
    expect(a!.height - c!.height).toBeCloseTo(2 * (b!.height - c!.height), 5)
    expect(c!.height).toBeCloseTo(8, 5)
  })

  it.each(['[-5, 5]', '[-2, -5, -8]', '[2, 5, 8]'])(
    'horizontal bar %s starts at the plot start and grows linearly',
    (data) => {
      const n = data.split(',').length
      const cats = ['a', 'b', 'c'].slice(0, n).join(', ')
      const l = layout(
        `xychart-beta horizontal\n x-axis [${cats}]\n bar ${data}`,
      )
      for (const bar of l.bars) expect(bar.x).toBe(l.plotArea.x)
      const w = l.bars.map((b) => b.width)
      const v = JSON.parse(data) as number[]
      // Width is linear in value: (w_i - w_0) / (v_i - v_0) is constant.
      const k = (w[1]! - w[0]!) / (v[1]! - v[0]!)
      for (let i = 2; i < n; i++)
        expect((w[i]! - w[0]!) / (v[i]! - v[0]!)).toBeCloseTo(k, 5)
    },
  )
})
