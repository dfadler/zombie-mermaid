/**
 * Value axis and x labels as mermaid 12.2.0 draws them (#2569): padding below
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

  it('keeps the zero line as the base when the range dips below zero', () => {
    const l = layout('xychart-beta\n x-axis [a, b]\n bar [-5, 5]')
    expect(l.bars[0]!.y + l.bars[0]!.height).toBeLessThan(
      l.plotArea.y + l.plotArea.height,
    )
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

describe('x labels', () => {
  it('labels all 20 dense categories', () => {
    const cats = Array.from({ length: 20 }, (_, i) => `W${i + 1}`)
    const l = layout(
      `xychart-beta\n x-axis [${cats.join(', ')}]\n bar [${cats.map(() => 1).join(', ')}]`,
    )
    expect(l.xAxis.ticks.map((t) => t.label)).toEqual(cats)
  })
})
