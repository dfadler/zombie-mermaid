/**
 * Category-label unquoting tests for the xychart-beta parser (issue #1087).
 *
 * `x-axis [A, "B", C]` categorical items were only `.split(',').map(trim)`,
 * so a quoted item like `"CLI output / logs"` kept its literal quote
 * characters in the rendered label instead of being unquoted the way an
 * axis *title* already is. These tests assert each category item is
 * unquoted the same way, and that a comma embedded inside a quoted item
 * (e.g. `"Jan, Feb"`) is treated as literal text rather than a delimiter.
 */
import { describe, it, expect } from 'vitest'
import { parseXYChart as parseXYChartStatements } from '@zombie-mermaid/mermaid-parser'
import { splitStatements } from '@zombie-mermaid/core'

/** Helper to parse — preprocesses text the same way index.ts does */
function parseXYChart(sourceLines: string[]) {
  return parseXYChartStatements(splitStatements(sourceLines.join('\n')))
}

describe('parseXYChart – categorical x-axis quoting', () => {
  it('strips quotes from quoted category items', () => {
    const chart = parseXYChart([
      'xychart-beta',
      'x-axis ["Total used", "CLI output / logs"]',
      'bar [86, 18]',
    ])
    expect(chart.xAxis.categories).toEqual(['Total used', 'CLI output / logs'])
  })

  it('handles a mix of quoted and unquoted category items', () => {
    const chart = parseXYChart([
      'xychart-beta',
      'x-axis [Jan, "Feb 2024", Mar]',
      'bar [1, 2, 3]',
    ])
    expect(chart.xAxis.categories).toEqual(['Jan', 'Feb 2024', 'Mar'])
  })

  it('still unquotes categories when an axis title is also present', () => {
    const chart = parseXYChart([
      'xychart-beta',
      'x-axis "Month" ["Jan", "Feb"]',
      'bar [1, 2]',
    ])
    expect(chart.xAxis.title).toBe('Month')
    expect(chart.xAxis.categories).toEqual(['Jan', 'Feb'])
  })

  it('leaves unquoted category items unchanged', () => {
    const chart = parseXYChart([
      'xychart-beta',
      'x-axis [Jan, Feb, Mar]',
      'bar [1, 2, 3]',
    ])
    expect(chart.xAxis.categories).toEqual(['Jan', 'Feb', 'Mar'])
  })

  it('treats a comma inside a quoted item as literal text, not a delimiter', () => {
    const chart = parseXYChart([
      'xychart-beta',
      'x-axis ["Jan, Feb", "Mar"]',
      'bar [1, 2]',
    ])
    // A naive split(',') would break this into three pieces ('"Jan',
    // ' Feb"', ' "Mar"') instead of two -- quoting a value that itself
    // contains a comma is exactly the case quoting exists for.
    expect(chart.xAxis.categories).toEqual(['Jan, Feb', 'Mar'])
  })

  it('handles multiple comma-containing quoted items in one list', () => {
    const chart = parseXYChart([
      'xychart-beta',
      'x-axis ["A, B", "C, D, E", F]',
      'bar [1, 2, 3]',
    ])
    expect(chart.xAxis.categories).toEqual(['A, B', 'C, D, E', 'F'])
  })
})
