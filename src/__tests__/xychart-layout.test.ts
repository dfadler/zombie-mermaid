/**
 * Coverage-focused tests for packages/svg-renderer/src/xychart/layout.ts.
 *
 * Exercises the horizontal layout path (previously untested), numeric
 * x-axis ranges (category label interpolation), multi-series bar groups,
 * and axis-title branch combinations that xychart-integration.test.ts
 * doesn't reach.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaid, renderMermaidSVG } from '../index.ts'
import {
  niceTickValues,
  formatTickLabels,
} from '../../packages/svg-renderer/src/xychart/layout.ts'

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
    const svg = await renderMermaid(
      `xychart-beta horizontal
  title "Horizontal Combo"
  x-axis "Category" [A, B, C]
  y-axis "Value" 0 --> 100
  bar [10, 50, 90]
  bar [20, 40, 60]
  line [15, 45, 75]`,
      { interactive: true },
    )
    expect(svg).toContain('Horizontal Combo')
    expect(svg).toContain('Category')
    expect(svg).toContain('Value')
    // Mermaid draws no legend for multiple series
    expect(svg).not.toContain('Bar 1')
    expect(svg).not.toContain('Line 1')
    expect(svg).toContain('data-value="20"')
    expect(svg).toContain('data-value="60"')
    expect(svg).toContain('data-value="15"')
    expect(svg).not.toContain('NaN')
  })

  it('lays out a horizontal chart with only a line series (no bars)', async () => {
    const svg = await renderMermaid(
      `xychart-beta horizontal
  x-axis [X, Y]
  y-axis 0 --> 10
  line [3, 8]`,
      { interactive: true },
    )
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
    // Mermaid draws no legend for multiple series
    expect(svg).not.toContain('Bar 1')
    expect(svg).not.toContain('Line 1')
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

describe('xychart – y-axis tick labels stay distinct (#1234)', () => {
  it('labels a narrow range with fractional steps', () => {
    const labels = formatTickLabels(niceTickValues(98.7, 102.3))
    expect(labels).toEqual([
      '99',
      '99.5',
      '100',
      '100.5',
      '101',
      '101.5',
      '102',
    ])
  })

  it('matches Mermaid (d3 ticks) density: 100..300 labels every 20 (#1705)', () => {
    expect(niceTickValues(100, 300)).toEqual(
      Array.from({ length: 11 }, (_, i) => 100 + i * 20),
    )
  })

  it.each([
    ['single value', 41.9, 42.1],
    ['all zeros', -0.1, 0.1],
    ['span of 3', 0, 3],
    ['wide range', 0, 1000],
    ['negative narrow', -102.3, -98.7],
  ])('never repeats a label: %s', (_name, min, max) => {
    const labels = formatTickLabels(niceTickValues(min, max))
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('renders distinct tick labels end to end for a flat series', async () => {
    const svg = await renderMermaid(`xychart-beta
  x-axis [A]
  bar [42]`)
    // Mermaid 12.2.0 gives a single value one tick, labelled with the value
    expect(svg).toContain('>42<')
    expect(svg).not.toContain('>41.9')
  })
})

describe('xychart – bars as mermaid draws them', () => {
  const d = (svg: string) =>
    [...svg.matchAll(/<path d="([^"]+)" class="xychart-bar /g)].map((m) => m[1])

  it('draws flat, unstroked bars', () => {
    const svg = renderMermaidSVG('xychart-beta\n  x-axis [a, b]\n  bar [1, 2]')
    expect(d(svg).every((p) => !/[QC]/.test(p!))).toBe(true)
    expect(svg).toContain('stroke: none; fill: var(--xychart-bar-fill-0)')
  })

  it('clips a bar that runs below the y-axis range and drops one wholly outside', () => {
    const svg = renderMermaidSVG(
      'xychart-beta\n  x-axis [a, b, c]\n  y-axis 50 --> 100\n  bar [30, 70, 20]',
    )
    const baseline = svg.match(/<path d="M[\d.]+,[\d.]+ V([\d.]+) H/)![1]
    const bars = d(svg)
    // The 30 bar is below the range, so it is dropped; the 70 bar ends on the axis
    expect(bars).toHaveLength(1)
    expect(bars[0]).toContain(`V${baseline} `)
  })
})
