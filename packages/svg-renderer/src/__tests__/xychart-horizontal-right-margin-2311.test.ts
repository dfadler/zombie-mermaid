/** #2311: the last value label of a horizontal chart must fit inside the viewBox. */
import { describe, it, expect } from 'vitest'
import { parseXYChart } from '@zombie-mermaid/mermaid-parser'
import { splitStatements } from '@zombie-mermaid/core'
import { layoutXYChart } from '../xychart/layout.ts'
import { estimateTextWidth } from '../styles.ts'

describe('horizontal XY chart right margin (#2311)', () => {
  it('keeps the last value label inside the width', () => {
    const l = layoutXYChart(
      parseXYChart(
        splitStatements(
          `xychart-beta horizontal
    x-axis [React, Vue]
    bar [220000, 210000]`,
        ),
      ),
    )
    const last = l.xAxis.ticks.at(-1)!
    const half = estimateTextWidth(last.label, 14, 400) / 2
    expect(last.labelX + half).toBeLessThanOrEqual(l.width)
  })
})
