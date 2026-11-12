/**
 * Value-axis tick labels for narrow and degenerate ranges (#1234).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

function render(text: string): string {
  return renderMermaidASCII(text, { colorMode: 'none' })
}

describe('xychart ASCII – narrow-range value-axis labels', () => {
  it('labels a 99-102 range with fractional ticks, not repeated integers', () => {
    const result = render(`xychart-beta
      x-axis [A, B, C, D]
      bar [100, 102, 99, 101]`)
    // Mermaid-matching ticks (d3 ticks(…, 10)): 0.2 steps over 99..102, every tick labelled (#2310)
    expect(result).toContain('99.4')
    expect(result).toContain('100.2')
  })

  it('renders a single tick label for a zero-width explicit range', () => {
    const result = render(`xychart-beta
      x-axis [A]
      y-axis 5 --> 5
      bar [5]`)
    expect(result).toContain('5')
  })

  it('labels the value axis of a horizontal chart with fractional ticks', () => {
    const result = render(`xychart-beta horizontal
      x-axis [A, B]
      bar [100, 102]`)
    expect(result).toMatch(/\d\.\d/)
  })

  it('thins y-axis labels so they sit on evenly spaced rows (#2310)', () => {
    const lines = render(`xychart-beta
      x-axis [A, B, C, D, E]
      bar [280, 260, 200, 180, 40]`).split('\n')
    const labeled = lines.flatMap((l, i) => (/^\s*\d+[┤┼]/.test(l) ? [i] : []))
    const gaps = labeled.slice(1).map((r, i) => r - labeled[i]!)
    expect(labeled.length).toBeGreaterThan(3)
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(2)
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1)
  })
})

describe('xychart ASCII – flat value series (#2727)', () => {
  const axisLabels = (out: string) =>
    out.split('\n').filter((l) => /^\s*-?[\d.]+[┤+]/.test(l))

  it.each([
    ['bar [42, 42, 42]', '42'],
    ['bar [0, 0, 0]', '0'],
    ['line [5]', '5'],
  ])('vertical %s draws one tick, as Mermaid does', (series, label) => {
    const rows = axisLabels(render(`xychart-beta\n  ${series}`))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.trim().startsWith(label)).toBe(true)
  })

  it('horizontal flat bars draw one tick label', () => {
    const out = render(`xychart-beta horizontal
      x-axis [a, b]
      bar [50, 50]`)
    expect(out).toContain('50')
    expect(out).not.toMatch(/50\.\d/)
  })

  it('horizontal flat line and mixed flat bar+line series draw one tick', () => {
    expect(
      render(`xychart-beta horizontal
        x-axis [a, b]
        line [7, 7]`),
    ).not.toMatch(/7\.\d/)
    const mixed = render(`xychart-beta
      x-axis [a, b]
      bar [3, 3]
      line [3, 3]`)
    expect(axisLabels(mixed)).toHaveLength(1)
  })
})

describe('xychart ASCII – flat negative series (#2772)', () => {
  // Mermaid 12.3.0 draws flat -5 like flat 5: bars from the mid-axis tick to the axis start.
  const strip = (out: string) => out.replace(/-5/g, '5')
  it.each(['bar', 'line'])('vertical %s [-5, -5] matches [5, 5]', (kind) => {
    const neg = render(`xychart-beta\n  x-axis [a, b]\n  ${kind} [-5, -5]`)
    expect(neg).toMatch(/-5[┤+]/)
    expect(neg.match(/█/g)?.length ?? 0).toBe(
      render(`xychart-beta\n  x-axis [a, b]\n  ${kind} [5, 5]`).match(/█/g)
        ?.length ?? 0,
    )
    if (kind === 'bar') expect(neg).toContain('█')
    expect(
      strip(neg)
        .split('\n')
        .map((l) => l.trim()),
    ).toEqual(
      render(`xychart-beta\n  x-axis [a, b]\n  ${kind} [5, 5]`)
        .split('\n')
        .map((l) => l.trim()),
    )
  })

  it('horizontal bar [-5, -5] draws the same bars as [5, 5]', () => {
    const run = (v: string) =>
      render(`xychart-beta horizontal\n  x-axis [a, b]\n  bar [${v}, ${v}]`)
    expect(strip(run('-5')).replace(/ +/g, ' ')).toBe(
      run('5').replace(/ +/g, ' '),
    )
  })
})

describe('xychart ASCII – every mermaid tick and axis title (#2310, #2678)', () => {
  const yLabels = (out: string) =>
    out.split('\n').flatMap((l) => l.match(/^\s*(-?[\d.]+)[┤┼]/)?.[1] ?? [])

  it('labels all 11 ticks of 0..1000, as mermaid 12.3.0 does', () => {
    const out = render(`xychart-beta
      x-axis [a, b]
      y-axis 0 --> 1000
      bar [100, 900]`)
    expect(yLabels(out)).toEqual([
      '1000',
      '900',
      '800',
      '700',
      '600',
      '500',
      '400',
      '300',
      '200',
      '100',
      '0',
    ])
  })

  it('gives each y tick label its own row with a blank row after it', () => {
    const lines = render(`xychart-beta
      x-axis [a, b]
      y-axis 0 --> 1000
      bar [100, 900]`).split('\n')
    const rows = lines.flatMap((l, i) => (/^\s*\d+[┤┼]/.test(l) ? [i] : []))
    expect(rows).toHaveLength(11)
    expect(Math.min(...rows.slice(1).map((r, i) => r - rows[i]!))).toBe(2)
  })

  it('widens a vertical numeric x range until every tick label shows', () => {
    const out = render(`xychart-beta
      x-axis 2020 --> 2024
      bar [3, 5, 2]`)
    const labelRow = out.split('\n').at(-1)!.trim().split(/\s+/)
    expect(labelRow).toEqual([
      '2020',
      '2020.5',
      '2021',
      '2021.5',
      '2022',
      '2022.5',
      '2023',
      '2023.5',
      '2024',
    ])
  })

  it('labels every value tick of a wide horizontal range on one row', () => {
    const out = render(`xychart-beta horizontal
      x-axis [a, b]
      y-axis 0 --> 220000
      bar [60000, 220000]`)
    const first = out.split('\n')[0]!.trim().split(/\s+/)
    expect(first).toEqual([
      '0',
      '20000',
      '40000',
      '60000',
      '80000',
      '100000',
      '120000',
      '140000',
      '160000',
      '180000',
      '200000',
      '220000',
    ])
  })

  it('draws the category axis title of a horizontal chart, rotated down the left edge', () => {
    const out = render(`xychart-beta horizontal
      x-axis "Month" [jan, feb, mar, apr]
      y-axis "Revenue" 0 --> 100
      bar [20, 50, 80, 40]`)
    const col0 = out
      .split('\n')
      .map((l) => l[0] ?? ' ')
      .join('')
      .replaceAll(' ', '')
    expect(col0).toBe('Month')
  })

  it.each([
    ['both titles', 'x-axis "Month" [a, b]\n y-axis "Rev" 0 --> 10'],
    ['x title only', 'x-axis "Month" [a, b]'],
    ['y title only', 'y-axis "Rev" 0 --> 10\n x-axis [a, b]'],
    ['no titles', 'x-axis [a, b]'],
  ])('vertical and horizontal charts draw %s', (_n, axes) => {
    const x = /x-axis "Month"/.test(axes)
    const y = /y-axis "Rev"/.test(axes)
    for (const dir of ['', ' horizontal']) {
      const out = render(`xychart-beta${dir}\n ${axes}\n bar [3, 7]`)
      const col0 = out
        .split('\n')
        .map((l) => l[0] ?? ' ')
        .join('')
      expect(
        col0.includes('Month') ||
          col0.replaceAll(' ', '').includes('Month') ||
          out.includes('Month'),
      ).toBe(x)
      expect(
        out.includes('Rev') || col0.replaceAll(' ', '').includes('Rev'),
      ).toBe(y)
    }
  })

  it('runs a horizontal numeric x range up the left edge, first point at the bottom', () => {
    const lines = render(`xychart-beta horizontal
      x-axis 0 --> 100
      bar [10, 20, 30, 40, 50]`).split('\n')
    const labels = lines.flatMap((l) => l.match(/^\s*(\d+)[┤│]/)?.[1] ?? [])
    expect(labels).toEqual([
      '100',
      '90',
      '80',
      '70',
      '60',
      '50',
      '40',
      '30',
      '20',
      '10',
      '0',
    ])
    // The 10-bar (first point) is on the 0 row at the bottom, the 50-bar on the 100 row
    const bar = (l: string) => l.match(/█+/)?.[0].length ?? 0
    expect(bar(lines.find((l) => /^\s*0[┤│]/.test(l))!)).toBeLessThan(
      bar(lines.find((l) => /^\s*100[┤│]/.test(l))!),
    )
  })
  it('clips a category title longer than the plot to the plot rows', () => {
    const title = 'A'.repeat(30)
    const out = render(`xychart-beta horizontal
      x-axis "${title}" [a, b]
      bar [3, 7]`)
    const col0 = out.split('\n').filter((l) => l[0] === 'A').length
    expect(col0).toBe(20)
  })

  it('labels the single tick of an empty horizontal numeric x range', () => {
    const out = render(`xychart-beta horizontal
      x-axis 5 --> 5
      bar [4, 6]`)
    expect(out.split('\n').some((l) => /^\s*5[┤│]/.test(l))).toBe(true)
  })

  it.each([
    ['one point', 'x-axis 0 --> 10\n bar [4]'],
    ['flat values', 'x-axis 0 --> 10\n bar [4, 4]'],
  ])('draws a horizontal numeric x range with %s', (_n, body) => {
    const out = render(`xychart-beta horizontal\n ${body}`)
    expect(out).toContain('█')
    expect(out.split('\n').some((l) => /^\s*(\d+)[┤│]/.test(l))).toBe(true)
  })
})
