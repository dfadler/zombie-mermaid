import { describe, it, expect } from 'vitest'
import { extractInitConfig } from '@zombie-mermaid/core'
import { renderMermaidASCII } from '../../../../src/index.ts'
import { renderMermaidSVG } from '../index.ts'

// `xyChart` init / front-matter keys, measured against mermaid 12.3.0 (#2905).
const BODY = `xychart-beta
  title "Sales"
  x-axis "Month" [jan, feb, mar]
  y-axis "Revenue" 0 --> 100
  bar [20, 50, 80]
  line [30, 45, 70]`
const init = (cfg: object) =>
  `%%{init: ${JSON.stringify({ xyChart: cfg })}}%%\n${BODY}`
const vb = (svg: string) =>
  /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)!.slice(1).map(Number)
const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length
const base = renderMermaidSVG(BODY)

describe('xyChart init config (#2905)', () => {
  it('parses honoured keys, drops bad values and reports the rest', () => {
    const c = extractInitConfig(
      init({
        width: 900,
        height: 'x',
        showTitle: false,
        chartOrientation: 'sideways',
        legendFontSize: 30,
        xAxis: { showTick: false, tickWidth: 9, showLabel: 1, tickGap: 3 },
        yAxis: 5,
      }).split('\n'),
    )
    expect(c.xyChart).toEqual({
      width: 900,
      showTitle: false,
      xAxis: { showTick: false, tickWidth: 9 },
    })
    expect(c.ignored).toEqual([
      'xyChart.legendFontSize',
      'xyChart.xAxis.tickGap',
    ])
  })

  it('width and height move the canvas by their delta from 700 x 500', () => {
    const [w = 0, h = 0] = vb(base)
    const [w2 = 0, h2 = 0] = vb(
      renderMermaidSVG(init({ width: 900, height: 300 })),
    )
    expect([w2 - w, h2 - h]).toEqual([200, -200])
  })

  it('the canvas is width x height for every combination of hidden parts (#2982)', () => {
    const hide = { showLabel: false, showTitle: false }
    const combos: object[] = [
      {},
      { showTitle: false },
      { xAxis: hide },
      { yAxis: hide },
      { showTitle: false, xAxis: hide, yAxis: hide },
    ]
    for (const orient of ['vertical', 'horizontal'] as const)
      for (const c of combos) {
        const svg = renderMermaidSVG(
          init({ chartOrientation: orient, width: 900, height: 420, ...c }),
        )
        expect(vb(svg)).toEqual([900, 420])
      }
    expect(vb(base)).toEqual([700, 500])
  })

  it('front matter reads the same keys as init', () => {
    const fm = `---\nconfig:\n  xyChart:\n    width: 900\n---\n${BODY}`
    expect(renderMermaidSVG(fm)).toBe(renderMermaidSVG(init({ width: 900 })))
  })

  it('showTitle false and axis showTitle false drop the titles', () => {
    expect(renderMermaidSVG(init({ showTitle: false }))).not.toContain(
      '>Sales<',
    )
    const s = renderMermaidSVG(init({ xAxis: { showTitle: false } }))
    expect(s).not.toContain('>Month<')
    expect(s).toContain('>Revenue<')
  })

  it('chartOrientation horizontal rotates the chart', () => {
    const h = renderMermaidSVG(init({ chartOrientation: 'horizontal' }))
    expect(h).toBe(
      renderMermaidSVG(BODY.replace('xychart-beta', 'xychart-beta horizontal')),
    )
    expect(h).not.toBe(base)
  })

  it('showLabel, showTick and showAxisLine are per axis', () => {
    const labels = (s: string) => count(s, /class="xychart-label"/g)
    const ticks = (s: string) => count(s, /class="xychart-axis"/g)
    const noXLabels = renderMermaidSVG(init({ xAxis: { showLabel: false } }))
    expect(labels(noXLabels)).toBe(labels(base) - 3)
    const noYLabels = renderMermaidSVG(init({ yAxis: { showLabel: false } }))
    expect(labels(noYLabels)).toBeLessThan(labels(noXLabels))
    expect(ticks(renderMermaidSVG(init({ xAxis: { showTick: false } })))).toBe(
      ticks(base) - 3,
    )
    expect(
      ticks(renderMermaidSVG(init({ yAxis: { showTick: false } }))),
    ).toBeLessThan(ticks(base) - 3)
    const off = renderMermaidSVG(
      init({ xAxis: { showAxisLine: false }, yAxis: { showAxisLine: false } }),
    )
    expect(ticks(off)).toBe(ticks(base) - 1)
    for (const [a, b] of [
      ['xAxis', 'yAxis'],
      ['yAxis', 'xAxis'],
    ] as const) {
      const one = renderMermaidSVG(init({ [a]: { showAxisLine: false } }))
      expect(count(one, /class="xychart-axis"/g)).toBe(ticks(base))
      expect(one).not.toBe(
        renderMermaidSVG(init({ [b]: { showAxisLine: false } })),
      )
    }
    const hz = (c: object) =>
      renderMermaidSVG(init({ chartOrientation: 'horizontal', ...c }))
    expect(hz({ xAxis: { showAxisLine: false } })).not.toBe(
      hz({ yAxis: { showAxisLine: false } }),
    )
    expect(hz({ yAxis: { showTick: false } })).not.toBe(
      hz({ xAxis: { showTick: false } }),
    )
    expect(hz({ yAxis: { showLabel: false } })).not.toBe(
      hz({ xAxis: { showLabel: false } }),
    )
    expect(
      hz({ xAxis: { showAxisLine: false }, yAxis: { showAxisLine: false } }),
    ).not.toBe(hz({}))
  })

  it('ASCII honours orientation and the title switches, not pixel sizes', () => {
    const a = (cfg: object) =>
      renderMermaidASCII(init(cfg), { colorMode: 'none' })
    expect(a({ showTitle: false })).not.toContain('Sales')
    expect(a({ xAxis: { showTitle: false } })).not.toContain('Month')
    expect(a({ chartOrientation: 'horizontal' })).not.toBe(a({}))
    expect(a({ width: 900 })).toBe(a({}))
  })
})
