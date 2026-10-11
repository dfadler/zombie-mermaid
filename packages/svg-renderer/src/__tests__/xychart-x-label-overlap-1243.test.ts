/**
 * #1243: with many categories the x-axis labels touched. The visual suite's
 * tolerance can't see labels moving a few pixels, so assert on the layout.
 */
import { describe, it, expect } from 'vitest'
import { parseXYChart } from '@zombie-mermaid/mermaid-parser'
import { splitStatements } from '@zombie-mermaid/core'
import { layoutXYChart } from '../xychart/layout.ts'
import { estimateTextWidth } from '../styles.ts'

function layout(src: string) {
  return layoutXYChart(parseXYChart(splitStatements(src)))
}

function shown(src: string) {
  return layout(src).xAxis.ticks.filter((t) => t.label !== '')
}

function minGap(ticks: ReturnType<typeof shown>): number {
  let gap = Infinity
  for (let i = 1; i < ticks.length; i++) {
    const a = ticks[i - 1]!
    const b = ticks[i]!
    const half =
      (estimateTextWidth(a.label, 14, 400) +
        estimateTextWidth(b.label, 14, 400)) /
      2
    gap = Math.min(gap, b.labelX - a.labelX - half)
  }
  return gap
}

const QUARTERS = `xychart-beta
    x-axis [21Q1, 21Q2, 21Q3, 21Q4, 22Q1, 22Q2, 22Q3, 22Q4, 23Q1, 23Q2, 23Q3, 23Q4, 24Q1, 24Q2, 24Q3, 24Q4]
    bar [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]`

describe('xychart x-axis label spacing (#1243)', () => {
  it('drops labels so adjacent shown labels do not touch', () => {
    const ticks = shown(QUARTERS)
    expect(ticks.length).toBeLessThan(16)
    expect(ticks.length).toBeGreaterThan(1)
    expect(minGap(ticks)).toBeGreaterThan(0)
  })

  it('keeps every label when they all fit', () => {
    const src = `xychart-beta
    x-axis [Q1, Q2, Q3, Q4]
    bar [1, 2, 3, 4]`
    expect(shown(src).map((t) => t.label)).toEqual(['Q1', 'Q2', 'Q3', 'Q4'])
  })

  it('does not thin a roomy axis because of one long label', () => {
    const src = `xychart-beta
    x-axis [A, B, "A Rather Long Category", D, E]
    bar [1, 2, 3, 4, 5]`
    expect(shown(src)).toHaveLength(5)
  })

  it('keeps the tick marks of dropped labels', () => {
    expect(layout(QUARTERS).xAxis.ticks).toHaveLength(16)
  })
})
