import { describe, it, expect } from 'vitest'
import { extractInitConfig } from '@zombie-mermaid/core'
import { renderMermaidSVG } from '../index.ts'

// xyChart font, padding, tick, line-width, rotation and data-label keys,
// measured against mermaid 12.3.0 (#2982, #3010).
const BODY = `xychart-beta
  title "Sales"
  x-axis "Month" [jan, feb, mar]
  y-axis "Revenue" 0 --> 100
  bar [30, 60, 90]`
const init = (cfg: object, orient = '') =>
  `%%{init: ${JSON.stringify({ xyChart: cfg })}}%%\n${BODY.replace('xychart-beta', `xychart-beta${orient}`)}`
const vb = (svg: string) =>
  /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)!.slice(1).map(Number)
const plot = (svg: string) => {
  const m = /<path d="M([\d.]+),([\d.]+) (?:V|L)([\d.]+)/.exec(svg)!
  return { left: +m[1]!, top: +m[2]!, bottom: +m[3]! }
}
const base = renderMermaidSVG(BODY)

describe('xyChart size keys (#3010)', () => {
  it('parses the keys, drops out-of-range values and reports none as ignored', () => {
    const c = extractInitConfig(
      init({
        titleFontSize: 30,
        titlePadding: -1,
        plotReservedSpacePercent: 101,
        showDataLabel: true,
        showDataLabelOutsideBar: 'yes',
        xAxis: { labelRotation: 45, tickWidth: 3, labelFontSize: 0 },
        yAxis: { axisLineWidth: '4' },
      }).split('\n'),
    )
    expect(c.xyChart).toEqual({
      titleFontSize: 30,
      showDataLabel: true,
      xAxis: { labelRotation: 45, tickWidth: 3 },
      yAxis: { axisLineWidth: 4 },
    })
    expect(c.ignored).toEqual([])
  })

  it('a chart without the keys is unchanged and the canvas stays 700 x 500', () => {
    expect(vb(base)).toEqual([700, 500])
    expect(base).not.toContain('xychart-data-label')
    expect(base).not.toContain('xychart-tick-')
  })

  // Plot-rectangle shifts measured on mermaid 12.3.0 (headless Chromium).
  it.each([
    ['titleFontSize 30', { titleFontSize: 30 }, { top: 12, bottom: 0 }],
    ['titlePadding 25', { titlePadding: 25 }, { top: 30, bottom: 0 }],
    [
      'xAxis labelPadding 15',
      { xAxis: { labelPadding: 15 } },
      { top: 0, bottom: -20 },
    ],
    [
      'xAxis tickLength 15',
      { xAxis: { tickLength: 15 } },
      { top: 0, bottom: -10 },
    ],
    [
      'xAxis axisLineWidth 8',
      { xAxis: { axisLineWidth: 8 } },
      { top: 0, bottom: -6 },
    ],
    [
      'xAxis titlePadding 12',
      { xAxis: { titlePadding: 12 } },
      { top: 0, bottom: -14 },
    ],
    [
      'xAxis labelFontSize 24',
      { xAxis: { labelFontSize: 24 } },
      { top: 0, bottom: -12 },
    ],
  ])('%s moves the plot as mermaid does', (_n, cfg, d) => {
    const a = plot(base)
    const b = plot(renderMermaidSVG(init(cfg)))
    expect(b.top - a.top).toBeCloseTo(d.top, 0)
    expect(b.bottom - a.bottom).toBeCloseTo(d.bottom, 0)
    expect(vb(renderMermaidSVG(init(cfg)))).toEqual([700, 500])
  })

  it('y axis keys move the left edge, in both orientations', () => {
    const left = (c: object, o = '') => plot(renderMermaidSVG(init(c, o))).left
    expect(left({ yAxis: { labelPadding: 15 } }) - left({})).toBeCloseTo(20, 0)
    expect(left({ yAxis: { tickLength: 15 } }) - left({})).toBeCloseTo(10, 0)
    expect(
      left({ xAxis: { labelPadding: 15 } }, ' horizontal') -
        left({}, ' horizontal'),
    ).toBeCloseTo(20, 0)
  })

  it('title and label font sizes are drawn', () => {
    const s = renderMermaidSVG(
      init({
        titleFontSize: 30,
        xAxis: { labelFontSize: 20, titleFontSize: 25 },
        yAxis: { titleFontSize: 22 },
      }),
    )
    expect(s).toMatch(/font-size="30"[^>]*class="xychart-title"/)
    expect(s).toMatch(/font-size="20"[^>]*class="xychart-label">jan/)
    expect(s).toMatch(/font-size="25"[^>]*class="xychart-axis-title">Month/)
    expect(s).toMatch(/font-size="22"[^>]*class="xychart-axis-title">Revenue/)
    const h = renderMermaidSVG(
      init({ xAxis: { labelFontSize: 20, titleFontSize: 25 } }, ' horizontal'),
    )
    expect(h).toMatch(/font-size="20"[^>]*class="xychart-label">jan/)
    expect(h).toMatch(/font-size="25"[^>]*class="xychart-axis-title">Month/)
    expect(
      renderMermaidSVG(
        init(
          { yAxis: { titleFontSize: 22, labelFontSize: 18 } },
          ' horizontal',
        ),
      ),
    ).toMatch(/font-size="22"[^>]*class="xychart-axis-title">Revenue/)
  })

  it('tickWidth and axisLineWidth set the stroke widths per axis', () => {
    const s = renderMermaidSVG(
      init({
        xAxis: { tickWidth: 5, axisLineWidth: 7 },
        yAxis: { tickWidth: 3, axisLineWidth: 4 },
      }),
    )
    expect(s).toContain('.xychart-tick-x { stroke-width: 5; }')
    expect(s).toContain('.xychart-tick-y { stroke-width: 3; }')
    expect(s).toContain('.xychart-axis-far { stroke-width: 7; }')
    expect(s).toContain('.xychart-axis-left { stroke-width: 4; }')
    const h = renderMermaidSVG(
      init(
        {
          xAxis: { axisLineWidth: 7, tickWidth: 5 },
          yAxis: { axisLineWidth: 4, tickWidth: 3 },
        },
        ' horizontal',
      ),
    )
    expect(h).toContain('.xychart-axis-left { stroke-width: 7; }')
    expect(h).toContain('.xychart-tick-x { stroke-width: 3; }')
    const noLine = renderMermaidSVG(
      init({ xAxis: { axisLineWidth: 7, showAxisLine: false } }),
    )
    expect(noLine).not.toContain('xychart-axis-far"')
    const noLeft = renderMermaidSVG(
      init({ yAxis: { axisLineWidth: 7, showAxisLine: false } }),
    )
    expect(noLeft).not.toContain('xychart-axis-left"')
  })

  it('labelRotation turns the bottom labels about their top centre and makes room', () => {
    const s = renderMermaidSVG(init({ xAxis: { labelRotation: 45 } }))
    expect(s).toMatch(
      /transform="rotate\(45,[\d.]+,[\d.]+\)"[^>]*dominant-baseline="text-before-edge"/,
    )
    expect(plot(s).bottom).toBeLessThan(plot(base).bottom)
    expect(renderMermaidSVG(init({ xAxis: { labelRotation: 120 } }))).toBe(base)
    // Mermaid turns the bottom axis only: a horizontal chart has none.
    expect(
      renderMermaidSVG(init({ xAxis: { labelRotation: 45 } }, ' horizontal')),
    ).not.toContain('rotate(45')
  })

  it('plotReservedSpacePercent drops the parts that do not fit, as mermaid does', () => {
    expect(
      vb(renderMermaidSVG(init({ plotReservedSpacePercent: 70 }))),
    ).toEqual([700, 500])
    const s = renderMermaidSVG(init({ plotReservedSpacePercent: 97 }))
    expect(s).not.toContain('>Sales<')
    expect(s).not.toContain('>jan<')
    const h = renderMermaidSVG(
      init({ plotReservedSpacePercent: 97 }, ' horizontal'),
    )
    expect(h).not.toContain('>Sales<')
    expect(h).not.toContain('>jan<')
    expect(h).not.toContain('>Revenue<')
  })

  it('showDataLabel prints the first series values on the bars', () => {
    const v = renderMermaidSVG(init({ showDataLabel: true }))
    expect(v).toMatch(
      /dominant-baseline="hanging"[^>]*class="xychart-data-label">30</,
    )
    expect(v).toContain('>90</text>')
    const out = renderMermaidSVG(
      init({ showDataLabel: true, showDataLabelOutsideBar: true }),
    )
    expect(out).toMatch(
      /dominant-baseline="auto"[^>]*class="xychart-data-label">30</,
    )
    const h = renderMermaidSVG(init({ showDataLabel: true }, ' horizontal'))
    expect(h).toMatch(
      /text-anchor="end" dominant-baseline="middle"[^>]*class="xychart-data-label">60</,
    )
    const ho = renderMermaidSVG(
      init(
        { showDataLabel: true, showDataLabelOutsideBar: true },
        ' horizontal',
      ),
    )
    expect(ho).toMatch(
      /text-anchor="start" dominant-baseline="middle"[^>]*class="xychart-data-label">60</,
    )
    // Mermaid takes the labels from the first series, even for a later bar series.
    const two = renderMermaidSVG(
      `%%{init: {"xyChart": {"showDataLabel": true}}}%%\nxychart-beta\n  x-axis [a, b]\n  y-axis 0 --> 100\n  line [11, 12]\n  bar [50, 60]`,
    )
    expect(two).toContain('>11</text>')
    expect(two).not.toMatch(/xychart-data-label">50</)
    // A bar series longer than the first has no label for its extra bars, and
    // a zero-height bar is not labelled.
    const gap = renderMermaidSVG(
      `%%{init: {"xyChart": {"showDataLabel": true}}}%%\nxychart-beta\n  x-axis [a, b, c]\n  y-axis 0 --> 100\n  line [5]\n  bar [0, 60, 70]`,
    )
    expect(gap).not.toMatch(/xychart-data-label">0</)
  })

  it('ASCII ignores the pixel keys', async () => {
    const { renderMermaidASCII } = await import('../../../../src/index.ts')
    expect(
      renderMermaidASCII(init({ titleFontSize: 30, showDataLabel: true }), {
        colorMode: 'none',
      }),
    ).toBe(renderMermaidASCII(BODY, { colorMode: 'none' }))
  })
})
