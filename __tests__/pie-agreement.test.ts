import { describe, expect, it } from 'vitest'
import { renderMermaidSVG } from '../src/index.ts'
import {
  parseOfficialPie,
  parseOurPie,
  pieAgreement,
  pieBreaches,
  sliceFromPath,
  strip,
  summarizePie,
  worstPie,
  type PieLayout,
} from '../scripts/lib/pie-agreement.ts'
import {
  scorecardMarkdown,
  summarize,
  type SampleResult,
} from '../scripts/lib/layout-agreement.ts'

// Trimmed from mermaid 12.2.0's render of `pie showData` with Chrome 75 and Safari 25.
const OFFICIAL = `<svg><g transform="translate(225,225)">
<path d="M0,-185A185,185,0,1,1,-185,0L0,0Z" fill="#ECECFF" class="pieCircle"></path>
<path d="M-185,0A185,185,0,0,1,0,-185L0,0Z" fill="#ffffde" class="pieCircle"></path>
<text transform="translate(1,2)" class="slice" style="text-anchor: middle;">75%</text>
<text transform="translate(3,4)" class="slice" style="text-anchor: middle;">25%</text>
<g class="legend" transform="translate(216,-11)"><rect width="18" height="18"></rect><text x="22" y="14">Chrome [75]</text></g>
<g class="legend" transform="translate(216,11)"><rect width="18" height="18"></rect><text x="22" y="14">Safari &amp; co [25]</text></g>
</g></svg>`

const SRC = `pie showData
  "Chrome" : 75
  "Safari & co" : 25`

describe('pie agreement (#2451)', () => {
  it('reads slices, percentages and legend rows from official mermaid', () => {
    const p = parseOfficialPie(OFFICIAL)
    expect(p.slices).toHaveLength(2)
    expect(p.slices[0]!.start).toBeCloseTo(0)
    expect(p.slices[0]!.sweep).toBeCloseTo(270)
    expect(p.slices[1]!.start).toBeCloseTo(270)
    expect(p.slices[1]!.sweep).toBeCloseTo(90)
    expect(p.labels).toEqual(['75%', '25%'])
    expect(p.legend).toEqual(['Chrome [75]', 'Safari & co [25]'])
  })

  it('agrees with our own render of the same source', () => {
    const ours = parseOurPie(renderMermaidSVG(SRC))
    const a = pieAgreement(parseOfficialPie(OFFICIAL), ours)
    expect(a).toMatchObject({ angles: 1, labels: 1, legend: 1, slices: 2 })
  })

  it('strips nested or partial tags from text without reassembling them', () => {
    expect(strip('<scr<script>ipt>x</scr</script>ipt>')).not.toContain('<')
    expect(strip('a<tspan>b</tspan> &amp; c')).toBe('ab & c')
  })

  it('skips paths it cannot read and tolerates a path with no numbers', () => {
    const p = parseOfficialPie(
      '<path d="M0,0L1,1" class="other"/><path class="pieCircle"/><path d="M0,0" class="pieCircle"/>',
    )
    expect(p.slices).toEqual([])
    expect(sliceFromPath('')).toBeUndefined()
    // One arc that ends where it starts is a full turn, not an empty slice.
    expect(sliceFromPath('M0,-185A185,185,0,1,1,0,-185L0,0Z')?.sweep).toBe(360)
  })

  it('averages nothing to null in the history entry', () => {
    const empty: PieLayout = { slices: [], labels: [], legend: [] }
    const entry = summarizePie(
      { a: pieAgreement(empty, empty) },
      { date: 'd', commit: 'c', mermaid: 'm' },
    )
    expect(entry).toMatchObject({ angles: null, labels: null, legend: null })
  })

  it('measures a whole circle as a 360 degree sweep', () => {
    expect(
      sliceFromPath('M0,-185A185,185,0,1,1,0,185A185,185,0,1,1,0,-185Z'),
    ).toEqual({ start: 0, sweep: 360 })
    expect(sliceFromPath('M0,0')).toBeUndefined()
  })

  it('catches swapped slices, a wrong percentage and a changed legend row', () => {
    const o = parseOfficialPie(OFFICIAL)
    const bad: PieLayout = {
      slices: [...o.slices].reverse(),
      labels: ['75%', '26%'],
      legend: ['Chrome [75]', 'Safari [25]'],
    }
    expect(pieAgreement(o, bad)).toMatchObject({
      angles: 0,
      labels: 0.5,
      legend: 0.5,
    })
  })

  it('counts a missing or extra slice as disagreement', () => {
    const o = parseOfficialPie(OFFICIAL)
    const fewer = pieAgreement(o, { ...o, slices: o.slices.slice(0, 1) })
    expect(fewer.angles).toBe(0.5)
    const more = pieAgreement({ ...o, slices: o.slices.slice(0, 1) }, o)
    expect(more.angles).toBe(0.5)
  })

  it('has no figure with nothing to compare', () => {
    const empty: PieLayout = { slices: [], labels: [], legend: [] }
    const a = pieAgreement(empty, empty)
    expect(a).toMatchObject({ angles: null, labels: null, legend: null })
    expect(worstPie(a)).toBeNull()
  })

  it('gates samples on the floor and on errors', () => {
    const o = parseOfficialPie(OFFICIAL)
    const ok = pieAgreement(o, o)
    const bad = pieAgreement(o, { slices: [], labels: [], legend: [] })
    expect(pieBreaches({ ok })).toEqual([])
    expect(pieBreaches({ ok, bad }, ['boom'])).toEqual([
      'boom (error)',
      'bad (0% < 100%)',
    ])
  })

  it('shows the pie section in the scorecard only with entries', () => {
    const o = parseOfficialPie(OFFICIAL)
    const entry = summarizePie(
      { a: pieAgreement(o, o) },
      { date: '2026-10-30', commit: 'abcdef0123', mermaid: '12.2.0' },
    )
    expect(entry).toMatchObject({ kind: 'pie', samples: 1, angles: 1 })
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
    const md = scorecardMarkdown([run], [run.entry], undefined, [], [], [entry])
    expect(md).toContain('## Pie charts (angles)')
    expect(md).toContain(
      '| 2026-10-30 | abcdef0 | 12.2.0 | 1 | 100% | 100% | 100% |',
    )
    expect(scorecardMarkdown([run], [run.entry])).not.toContain('Pie charts')
  })
})
