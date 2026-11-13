// xyChart.xAxis / yAxis showLabel, showTick, showAxisLine in ASCII (#3073).
// Expectations were checked against mermaid@12.3.0 (scripts/lib/real-mermaid.ts)
// for every combination of the four keys per axis, both orientations.
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../index.ts'

const render = (
  x: object,
  y: object,
  opts: { horizontal?: boolean; linear?: boolean; titles?: boolean } = {},
  ascii = false,
): string => {
  const t = opts.titles ?? true
  const xa = opts.linear ? '0 --> 10' : '[jan, feb, mar]'
  return renderMermaidASCII(
    `%%{init: {"xyChart": {"xAxis": ${JSON.stringify(x)}, "yAxis": ${JSON.stringify(y)}}}}%%
xychart-beta${opts.horizontal ? ' horizontal' : ''}
  x-axis ${t ? '"Month" ' : ''}${xa}
  y-axis ${t ? '"Revenue" ' : ''}0 --> 100
  bar [20, 50, 80]`,
    { useAscii: ascii },
  )
}

describe('xychart axis flags (ASCII, #3073)', () => {
  it('draws labels, ticks and lines by default', () => {
    const out = render({}, {})
    expect(out).toContain('jan')
    expect(out).toContain('100')
    expect(out).toMatch(/┬/)
    expect(out).toMatch(/┤/)
  })

  it('xAxis.showLabel false drops the category labels and their row (vertical)', () => {
    const lines = render({ showLabel: false }, {}).split('\n')
    expect(lines.join('\n')).not.toContain('jan')
    expect(lines.join('\n')).toContain('100')
    // the title sits directly under the axis line
    expect(lines.at(-1)).toContain('Month')
    expect(lines.at(-2)).toMatch(/┬/)
  })

  it('xAxis.showLabel false drops the category labels (horizontal)', () => {
    const out = render({ showLabel: false }, {}, { horizontal: true })
    expect(out).not.toContain('jan')
    expect(out).toContain('100')
  })

  it('yAxis.showLabel false drops the value labels (both orientations)', () => {
    for (const horizontal of [false, true]) {
      const out = render({}, { showLabel: false }, { horizontal })
      expect(out).not.toContain('100')
      expect(out).toContain('jan')
    }
  })

  it('yAxis.showLabel false on a horizontal chart leaves no label row', () => {
    const withLabels = render({}, {}, { horizontal: true }).split('\n')
    const without = render(
      {},
      { showLabel: false },
      {
        horizontal: true,
      },
    ).split('\n')
    expect(without.length).toBe(withLabels.length - 1)
  })

  it('showTick false keeps the axis line but drops the tick marks', () => {
    const out = render({ showTick: false }, { showTick: false })
    expect(out).not.toMatch(/[┬┤]/)
    expect(out).toMatch(/─{10}/)
    expect(out).toContain('jan')
  })

  it('showAxisLine false drops the line, a tick stays as a lone stub', () => {
    const out = render({ showAxisLine: false }, { showAxisLine: false })
    expect(out).not.toMatch(/─{4}/)
    expect(out).not.toContain('┼')
    expect(out).toMatch(/│/) // x ticks, as stubs
    expect(out).toMatch(/─/) // y ticks, as stubs
  })

  it('showAxisLine and showTick false together leave only labels', () => {
    const out = render(
      { showAxisLine: false, showTick: false },
      { showAxisLine: false, showTick: false },
    )
    expect(out).not.toMatch(/[┬┤┼│]/)
    expect(out).toContain('jan')
    expect(out).toContain('100')
  })

  it('draws the same hidden parts in ASCII (non-Unicode) mode', () => {
    const out = render(
      { showLabel: false, showTick: false },
      { showAxisLine: false },
      {},
      true,
    )
    expect(out).not.toContain('jan')
    expect(out).toContain('100')
    expect(out).not.toMatch(/[^\x00-\x7f]/)
  })

  it('horizontal: each of the three keys hides its part on the category axis', () => {
    const base = render({}, {}, { horizontal: true })
    expect(base).toMatch(/jan┤/)
    expect(render({ showTick: false }, {}, { horizontal: true })).not.toMatch(
      /jan┤/,
    )
    const noLine = render({ showAxisLine: false }, {}, { horizontal: true })
    expect(noLine).toMatch(/jan─/)
    expect(noLine).not.toContain('┼')
  })

  it('horizontal: value axis keys hide the labels, ticks and line on top', () => {
    const noTick = render({}, { showTick: false }, { horizontal: true })
    expect(noTick).not.toContain('┬')
    expect(noTick).toMatch(/─{10}/)
    const noLine = render({}, { showAxisLine: false }, { horizontal: true })
    expect(noLine).not.toMatch(/─{4}/)
    expect(noLine).not.toContain('┬')
    // the ticks stay, as stubs
    expect(noLine).toMatch(/│ {5}│/)
  })

  it('a linear x axis honours the same keys', () => {
    const out = render(
      { showLabel: false },
      { showTick: false },
      {
        linear: true,
      },
    )
    expect(out).not.toContain('2.5')
    expect(out).not.toMatch(/┤/)
    expect(out).toContain('Month')
  })

  it('the issue sample: no category labels, y ticks and line off', () => {
    const out = render(
      { showLabel: false },
      {
        showTick: false,
        showAxisLine: false,
      },
    )
    expect(out).not.toContain('jan')
    expect(out).toContain('Revenue'.slice(0, 1))
    expect(out).not.toContain('┤')
  })
})
