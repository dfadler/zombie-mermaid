/**
 * Coverage-focused tests for src/xychart/layout.ts.
 *
 * Exercises the horizontal layout path (previously untested), numeric
 * x-axis ranges (category label interpolation), multi-series bar groups,
 * and axis-title branch combinations that xychart-integration.test.ts
 * doesn't reach.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaid } from '../index.ts'

describe('xychart – horizontal layout', () => {
  it('lays out a single-series horizontal bar chart', async () => {
    const svg = await renderMermaid(`xychart-beta horizontal
  x-axis [A, B, C]
  y-axis 0 --> 100
  bar [10, 50, 90]`)
    expect(svg).toContain('data-value="10"')
    expect(svg).toContain('data-value="90"')
    expect(svg).toContain('data-label="A"')
    expect(svg).toContain('data-label="C"')
    expect(svg).not.toContain('NaN')
  })

  it('lays out a horizontal chart with title, axis titles, multiple bar series, and a line series', async () => {
    const svg = await renderMermaid(`xychart-beta horizontal
  title "Horizontal Combo"
  x-axis "Category" [A, B, C]
  y-axis "Value" 0 --> 100
  bar [10, 50, 90]
  bar [20, 40, 60]
  line [15, 45, 75]`)
    expect(svg).toContain('Horizontal Combo')
    expect(svg).toContain('Category')
    expect(svg).toContain('Value')
    expect(svg).toContain('Bar 1')
    expect(svg).toContain('Bar 2')
    expect(svg).toContain('Line 1')
    expect(svg).toContain('data-value="20"')
    expect(svg).toContain('data-value="60"')
    expect(svg).toContain('data-value="15"')
    expect(svg).not.toContain('NaN')
  })

  it('lays out a horizontal chart with only a line series (no bars)', async () => {
    const svg = await renderMermaid(`xychart-beta horizontal
  x-axis [X, Y]
  y-axis 0 --> 10
  line [3, 8]`)
    expect(svg).toContain('data-value="3"')
    expect(svg).toContain('data-value="8"')
    expect(svg).toContain('data-label="X"')
    expect(svg).not.toContain('NaN')
  })

  it('lays out a horizontal chart with negative values', async () => {
    const svg = await renderMermaid(`xychart-beta horizontal
  x-axis [A, B, C]
  y-axis -50 --> 50
  bar [-30, 20, 40]`)
    expect(svg).toContain('data-value="-30"')
    expect(svg).toContain('data-value="40"')
    expect(svg).not.toContain('NaN')
  })
})

describe('xychart – numeric x-axis range (category interpolation)', () => {
  it('interpolates category labels across a numeric x-axis range with a title', async () => {
    const svg = await renderMermaid(`xychart-beta
  x-axis "Distance" 0 --> 17
  y-axis "Value" 0 --> 100
  bar [10, 40, 70, 90]`)
    expect(svg).toContain('Distance')
    expect(svg).toContain('data-label="0"')
    expect(svg).toContain('data-label="17"')
    expect(svg).toContain('data-label="5.7"')
    expect(svg).toContain('data-label="11"')
    expect(svg).not.toContain('NaN')
  })

  it('falls back to numeric index labels when x-axis is unspecified', async () => {
    const svg = await renderMermaid(`xychart-beta
  y-axis 0 --> 100
  bar [10, 20, 30]`)
    expect(svg).toContain('data-value="10"')
    expect(svg).toContain('data-label="1"')
    expect(svg).toContain('data-label="3"')
    expect(svg).not.toContain('NaN')
  })

  it('handles a single-point series on a numeric x-axis range', async () => {
    const svg = await renderMermaid(`xychart-beta
  x-axis 0 --> 10
  y-axis 0 --> 50
  bar [25]`)
    expect(svg).toContain('data-value="25"')
    expect(svg).toContain('data-label="0"')
    expect(svg).not.toContain('NaN')
  })
})

describe('xychart – vertical layout branch coverage', () => {
  it('lays out a chart without a y-axis title (single series, no legend)', async () => {
    const svg = await renderMermaid(`xychart-beta
  x-axis [A, B]
  y-axis 0 --> 10
  bar [3, 8]`)
    expect(svg).toContain('data-value="3"')
    expect(svg).toContain('data-value="8"')
    expect(svg).not.toContain('class="xychart-axis-title"')
  })

  it('lays out a chart with two bar series and a line series (multi-bar grouping)', async () => {
    const svg = await renderMermaid(`xychart-beta
  title "Multi Bar"
  x-axis [Q1, Q2, Q3]
  y-axis "Sales" 0 --> 200
  bar [50, 80, 120]
  bar [30, 60, 90]
  line [40, 70, 100]`)
    expect(svg).toContain('Multi Bar')
    expect(svg).toContain('Bar 1')
    expect(svg).toContain('Bar 2')
    expect(svg).toContain('Line 1')
    expect(svg).toContain('data-value="120"')
    expect(svg).toContain('data-value="90"')
    expect(svg).not.toContain('NaN')
  })

  it('lays out a chart with negative values (baseline clamped to zero)', async () => {
    const svg = await renderMermaid(`xychart-beta
  x-axis [A, B, C]
  y-axis -50 --> 50
  bar [-30, 20, 40]`)
    expect(svg).toContain('data-value="-30"')
    expect(svg).toContain('data-value="40"')
    expect(svg).not.toContain('NaN')
  })

  it('renders a chart with no series at all', async () => {
    const svg = await renderMermaid(`xychart-beta
  x-axis 0 --> 10
  y-axis 0 --> 100`)
    expect(svg).toContain('<svg')
    expect(svg).not.toContain('NaN')
  })

  it('handles a degenerate y-axis range where min equals max', async () => {
    const svg = await renderMermaid(`xychart-beta
  x-axis [A, B]
  y-axis 5 --> 5
  bar [5, 5]`)
    expect(svg).toContain('<svg')
    expect(svg).toContain('data-value="5"')
    expect(svg).not.toContain('NaN')
  })

  it('picks a tick interval equal to the magnitude for a small range', async () => {
    const svg = await renderMermaid(`xychart-beta
  x-axis [A, B]
  y-axis 0 --> 6
  bar [2, 5]`)
    expect(svg).toContain('data-label="A"')
    expect(svg).toContain('data-value="2"')
    expect(svg).not.toContain('NaN')
  })
})
