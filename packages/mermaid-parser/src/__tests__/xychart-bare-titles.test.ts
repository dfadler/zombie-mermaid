/**
 * Unquoted xychart titles, measured against mermaid 12.3.0 (#2728): letters,
 * digits and spaces only, spaces dropped (`title Week 1 sales` -> `Week1sales`).
 */
import { describe, it, expect } from 'vitest'
import { parseXYChart } from '@zombie-mermaid/mermaid-parser'
import { splitStatements } from '@zombie-mermaid/core'

const parse = (head: string) =>
  parseXYChart(splitStatements(`xychart-beta\n${head}\n bar [1, 2]`))

describe('unquoted xychart titles', () => {
  it('drops spaces in an unquoted title', () => {
    expect(parse(' title  Week 1   sales \n x-axis [a, b]').title).toBe(
      'Week1sales',
    )
  })
  it('keeps a quoted title as written', () => {
    expect(parse(' title "Week 1"\n x-axis [a, b]').title).toBe('Week 1')
  })
  it('reads an unquoted y-axis title with and without a range', () => {
    expect(parse(' x-axis [a, b]\n y-axis Y Z').yAxis.title).toBe('YZ')
    expect(parse(' x-axis [a, b]\n y-axis Y Z 0 --> 5').yAxis.title).toBe('YZ')
  })
  it('reads a one-word unquoted x-axis title for categories and a range', () => {
    expect(parse(' x-axis Foo [a, b]').xAxis.title).toBe('Foo')
    expect(parse(' x-axis Foo 0 --> 5').xAxis.title).toBe('Foo')
  })
  it('still rejects an unquoted title with other characters', () => {
    expect(() => parse(' title Q1/Q2\n x-axis [a, b]')).toThrow()
  })
})
