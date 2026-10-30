import { describe, expect, it } from 'vitest'
import { renderMermaidSVG } from '../src/index.ts'
import {
  barBox,
  DATA_FLOOR,
  isHorizontal,
  parseOfficialXy,
  parseOurXy,
  pathPoints,
  strip,
  summarizeXy,
  xyAgreement,
  xyBreaches,
  type XyLayout,
} from '../scripts/lib/xychart-agreement.ts'
import {
  scorecardMarkdown,
  summarize,
  type SampleResult,
} from '../scripts/lib/layout-agreement.ts'

const SRC = `xychart-beta
    title "Product Sales"
    x-axis [Widgets, Gadgets, Gizmos, Doodads, Thingamajigs]
    bar [150, 230, 180, 95, 310]`

// Trimmed from mermaid 12.2.0's render of the sample above (the value axis
// is listed top to bottom, bars reach the axis line below the last tick).
const OFFICIAL = `<svg><g class="main"><g class="plot">
<g class="bar-plot-0">
<rect x="41.096484375" y="354.62790697674416" width="78.47890625" height="112.37209302325584" fill="#ECECFF"></rect>
<rect x="185.686328125" y="202.81395348837208" width="78.47890625" height="264.1860465116279" fill="#ECECFF"></rect>
<rect x="330.276171875" y="297.69767441860466" width="78.47890625" height="169.30232558139534" fill="#ECECFF"></rect>
<rect x="474.866015625" y="459" width="78.47890625" height="8" fill="#ECECFF"></rect>
<rect x="619.455859375" y="51" width="78.47890625" height="416" fill="#ECECFF"></rect>
</g>
</g>
<g class="bottom-axis"><g class="axis-line"><path d="M 0,467 L 700,467"></path></g>
<g class="label">
<text transform="translate(80.3359375, 479) rotate(0)">Widgets</text>
<text transform="translate(224.92578125, 479) rotate(0)">Gadgets</text>
<text transform="translate(369.515625, 479) rotate(0)">Gizmos</text>
<text transform="translate(514.10546875, 479) rotate(0)">Doodads</text>
<text transform="translate(658.6953125, 479) rotate(0)">Thingamajigs</text>
</g>
<g class="ticks"><path d="M 80,468 L 80,473"></path></g></g>
<g class="left-axis"><g class="label">
<text transform="translate(27.03, 69.9767441860465) rotate(0)">300</text>
<text transform="translate(27.03, 107.93023255813955) rotate(0)">280</text>
<text transform="translate(27.03, 145.88372093023256) rotate(0)">260</text>
<text transform="translate(27.03, 183.8372093023256) rotate(0)">240</text>
<text transform="translate(27.03, 221.7906976744186) rotate(0)">220</text>
<text transform="translate(27.03, 259.74418604651163) rotate(0)">200</text>
<text transform="translate(27.03, 297.69767441860466) rotate(0)">180</text>
<text transform="translate(27.03, 335.6511627906977) rotate(0)">160</text>
<text transform="translate(27.03, 373.6046511627907) rotate(0)">140</text>
<text transform="translate(27.03, 411.55813953488376) rotate(0)">120</text>
<text transform="translate(27.03, 449.51162790697674) rotate(0)">100</text>
</g></g>
<g class="mermaid-tmp-group"><text transform="translate(1, 2) rotate(0)">tmp</text></g>
</g></svg>`

describe('xychart agreement (#2451)', () => {
  it('reads the official drawing: labels by axis, bar ends and line points', () => {
    const o = parseOfficialXy(OFFICIAL, false)
    // The tmp group is not an axis, and labels come back sorted along the axis.
    expect(o.xLabels.map((l) => l.text)).toEqual([
      'Widgets',
      'Gadgets',
      'Gizmos',
      'Doodads',
      'Thingamajigs',
    ])
    expect(o.yLabels).toHaveLength(11)
    expect(o.yLabels[0]).toMatchObject({ text: '300' })
    expect(o.yLabels[10]).toMatchObject({ text: '100' })
    // Bar centre across the category axis, bar top as the value.
    expect(o.points).toHaveLength(5)
    expect(o.points[0]).toEqual({
      cat: 41.096484375 + 78.47890625 / 2,
      val: 354.62790697674416,
    })
  })

  it('reads a horizontal chart: categories at the left, values on top', () => {
    const o = parseOfficialXy(
      `<g class="plot"><g class="bar-plot-0"><rect x="10" y="20" width="90" height="40"></rect></g></g>
<g class="left-axis"><g class="label"><text transform="translate(5, 40) rotate(0)">A</text></g></g>
<g class="top-axis"><g class="label"><text transform="translate(100, 3) rotate(0)">8</text></g></g>`,
      true,
    )
    expect(o.xLabels).toEqual([{ text: 'A', pos: 40 }])
    expect(o.yLabels).toEqual([{ text: '8', pos: 100 }])
    expect(o.points).toEqual([{ cat: 40, val: 100 }])
    expect(isHorizontal('xychart-beta horizontal\n bar [1]')).toBe(true)
    expect(isHorizontal(SRC)).toBe(false)
  })

  it('agrees with our own render of the same source', () => {
    const a = xyAgreement(
      parseOfficialXy(OFFICIAL, false),
      parseOurXy(renderMermaidSVG(SRC), false),
    )
    expect(a).toMatchObject({ labels: 1, ticks: 1, data: 1, points: 5 })
  })

  it('reads horizontal bars of ours, including a zero-width bar', () => {
    const ours = parseOurXy(
      renderMermaidSVG(`xychart-beta horizontal
    x-axis [A, B]
    bar [30, 8]`),
      true,
    )
    expect(ours.xLabels.map((l) => l.text)).toEqual(['A', 'B'])
    expect(ours.yLabels.length).toBeGreaterThan(1)
    expect(ours.points).toHaveLength(2)
    expect(ours.points[1]!.val).toBe(ours.yLabels[0]!.pos)
  })

  it('reads line points, upright and horizontal', () => {
    const svg = `<g class="line-plot-0"><path d="M80,354L224,202" fill="none"></path></g>`
    expect(parseOfficialXy(svg, false).points).toEqual([
      { cat: 80, val: 354 },
      { cat: 224, val: 202 },
    ])
    expect(parseOfficialXy(svg, true).points[0]).toEqual({ cat: 354, val: 80 })
    const ours = parseOurXy(
      renderMermaidSVG(
        'xychart-beta\n    x-axis [A, B, C]\n    line [1, 3, 2]',
      ),
      false,
    )
    expect(ours.points).toHaveLength(3)
    expect(ours.points[1]!.val).toBeLessThan(ours.points[0]!.val)
  })

  it('strips nested or partial tags from text without reassembling them', () => {
    expect(strip('<scr<script>ipt>x</scr</script>ipt>')).not.toContain('<')
    expect(strip(' a<tspan>b</tspan> &amp; c ')).toBe('ab & c')
  })

  it('skips what is not a drawn item', () => {
    // Right axis, label without a position, path without d, text without class.
    const o = parseOfficialXy(
      `<g class="right-axis"><g class="label"><text transform="translate(1, 2) rotate(0)">r</text></g></g>
<g class="left-axis"><g class="label"><text>no position</text></g></g>
<g class="line-plot-0"><path fill="none"></path></g>`,
      false,
    )
    expect(o).toEqual({ xLabels: [], yLabels: [], points: [] })
    const ours = parseOurXy(
      `<text x="1" y="2">plain</text>
<text x="1" y="2" text-anchor="start" class="xychart-label">legend</text>
<path d="M1,2"></path><path class="xychart-line"></path>`,
      false,
    )
    expect(ours).toEqual({ xLabels: [], yLabels: [], points: [] })
    expect(pathPoints('M')).toEqual([])
  })

  it('handles one-label axes, shorter label lists and empty summaries', () => {
    const one: XyLayout = {
      xLabels: [{ text: 'A', pos: 5 }],
      yLabels: [{ text: '1', pos: 5 }],
      points: [{ cat: 5, val: 5 }],
    }
    expect(xyAgreement(one, one)).toMatchObject({ ticks: 1, data: 1 })
    expect(xyAgreement(one, { ...one, xLabels: [] }).labels).toBe(0.5)
    expect(
      summarizeXy({}, { date: 'd', commit: 'c', mermaid: 'm' }),
    ).toMatchObject({ samples: 0, labels: null, ticks: null, data: null })
  })

  it('measures bar paths and line paths', () => {
    expect(barBox('M112.5,350 h0 v40 h0 Z')).toEqual({
      x0: 112.5,
      y0: 350,
      x1: 112.5,
      y1: 390,
    })
    expect(barBox('M133,297 Q133,289 141,289 L165,289 Z')).toMatchObject({
      x0: 133,
      y0: 289,
      x1: 165,
      y1: 297,
    })
    expect(pathPoints('M1,2C3,4 5,6 7,8L9,10')).toEqual([
      [1, 2],
      [7, 8],
      [9, 10],
    ])
  })

  it('catches a wrong label, a shifted tick and a moved bar', () => {
    const o = parseOfficialXy(OFFICIAL, false)
    const wrongLabel: XyLayout = {
      ...o,
      xLabels: o.xLabels.map((l, i) => (i === 1 ? { ...l, text: 'X' } : l)),
    }
    expect(xyAgreement(o, wrongLabel).labels).toBeCloseTo(15 / 16)
    const shifted: XyLayout = {
      ...o,
      yLabels: o.yLabels.map((l, i) => (i === 1 ? { ...l, pos: 400 } : l)),
    }
    expect(xyAgreement(o, shifted).ticks).toBeCloseTo(15 / 16)
    const moved: XyLayout = {
      ...o,
      points: o.points.map((p, i) => (i === 0 ? { ...p, val: 300 } : p)),
    }
    expect(xyAgreement(o, moved).data).toBeCloseTo(4 / 5)
  })

  it('counts a missing or extra item as disagreement, and nothing as null', () => {
    const o = parseOfficialXy(OFFICIAL, false)
    expect(xyAgreement(o, { ...o, points: o.points.slice(0, 2) }).data).toBe(
      0.4,
    )
    expect(xyAgreement({ ...o, points: o.points.slice(0, 2) }, o).data).toBe(
      0.4,
    )
    const empty: XyLayout = { xLabels: [], yLabels: [], points: [] }
    expect(xyAgreement(empty, empty)).toMatchObject({
      labels: null,
      ticks: null,
      data: null,
    })
  })

  it('gates samples on the floor, on errors and on the data exception', () => {
    const o = parseOfficialXy(OFFICIAL, false)
    const ok = xyAgreement(o, o)
    const bad = xyAgreement(o, { ...o, points: [] })
    expect(xyBreaches({ ok })).toEqual([])
    expect(xyBreaches({ ok, bad }, ['boom'])).toEqual([
      'boom (error)',
      'bad data (0% < 100%)',
    ])
    const known = Object.keys(DATA_FLOOR)[0]!
    expect(xyBreaches({ [known]: bad })).toEqual([])
    expect(xyBreaches({ [known]: { ...bad, labels: 0.5 } })).toEqual([
      `${known} labels (50% < 100%)`,
    ])
  })

  it('shows the xychart section in the scorecard only with entries', () => {
    const o = parseOfficialXy(OFFICIAL, false)
    const entry = summarizeXy(
      { a: xyAgreement(o, o) },
      { date: '2026-10-30', commit: 'abcdef0123', mermaid: '12.2.0' },
    )
    expect(entry).toMatchObject({ kind: 'xychart', samples: 1, data: 1 })
    const results: Record<string, SampleResult> = {}
    const run = {
      results,
      entry: summarize(results, {
        date: 'd',
        commit: 'c',
        tolerance: 20,
        type: 'flowchart',
        mermaid: '12.2.0',
      }),
    }
    const md = scorecardMarkdown(
      [run],
      [run.entry],
      undefined,
      [],
      [],
      [],
      [entry],
    )
    expect(md).toContain('## XY charts (axes and data)')
    expect(md).toContain(
      '| 2026-10-30 | abcdef0 | 12.2.0 | 1 | 100% | 100% | 100% |',
    )
    expect(scorecardMarkdown([run], [run.entry])).not.toContain('## XY charts')
  })
})
