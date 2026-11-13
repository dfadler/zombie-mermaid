import { describe, expect, it } from 'vitest'
import {
  parseSankeySvg,
  sankeyAgreement,
  sankeyBreaches,
  worstSankey,
  type SankeyLayout,
} from '../scripts/lib/sankey-agreement.ts'

const svg = (w = 600, dx = 0): string =>
  `<svg viewBox="${dx} 0 ${w} 400"><g class="nodes">` +
  `<g class="node" transform="translate(${dx},0)"><rect height="400" width="10" fill="red"></rect></g>` +
  `<g class="node" transform="translate(${dx + 590},0)"><rect height="200" width="10" fill="red"></rect></g></g>` +
  `<g class="node-labels" font-size="14"><text x="${dx + 16}" y="200" dy="0em" text-anchor="start">A\n10</text>` +
  `<text x="${dx + 584}" y="100" dy="0em" text-anchor="end">B &amp; C\n5</text></g>` +
  `<g class="links"><g class="link"><path d="M${dx + 10},200C${dx + 300},200,${dx + 300},100,${dx + 590},100" stroke-width="200"></path></g></g></svg>`

describe('parseSankeySvg', () => {
  it('reads bars, labels, ribbons and the size relative to the viewBox origin', () => {
    const l = parseSankeySvg(svg(600, 5))
    expect(l.size).toEqual({ width: 600, height: 400 })
    expect(l.bars[1]).toEqual({ x: 590, y: 0, width: 10, height: 200 })
    expect(l.labels[1]).toEqual({
      x: 584,
      y: 100,
      anchor: 'end',
      text: 'B & C 5',
    })
    expect(l.ribbons[0]!.nums).toEqual([
      10, 200, 300, 200, 300, 100, 590, 100, 200,
    ])
  })

  it('has no size without a viewBox', () => {
    expect(parseSankeySvg('<svg></svg>')).toEqual({
      bars: [],
      labels: [],
      ribbons: [],
      size: undefined,
    })
  })
})

describe('sankeyAgreement', () => {
  const base = parseSankeySvg(svg())
  const full = { bars: 1, labels: 1, ribbons: 1, frame: 1, nodes: 2 }

  it('agrees with itself, and ignores a uniform shift of ours (label padding)', () => {
    expect(sankeyAgreement(base, base)).toEqual(full)
    expect(sankeyAgreement(base, parseSankeySvg(svg(615, 7)))).toEqual(full)
  })

  it.each<[string, (l: SankeyLayout) => void, Partial<typeof full>]>([
    ['a bar', (l) => (l.bars[1]!.height += 1), { bars: 0.5 }],
    ['a label', (l) => (l.labels[0]!.text = 'X'), { labels: 0.5 }],
    ['a label anchor', (l) => (l.labels[0]!.anchor = 'end'), { labels: 0.5 }],
    ['a ribbon', (l) => (l.ribbons[0]!.nums[8]! += 1), { ribbons: 0 }],
    ['a missing ribbon point', (l) => l.ribbons[0]!.nums.pop(), { ribbons: 0 }],
    ['the height', (l) => (l.size!.height += 1), { frame: 0 }],
    ['a narrower drawing', (l) => (l.size!.width -= 1), { frame: 0 }],
    ['a much wider drawing', (l) => (l.size!.width *= 1.2), { frame: 0 }],
    ['a missing size', (l) => (l.size = undefined), { frame: 0 }],
  ])('flags %s', (_, mutate, expected) => {
    const ours = structuredClone(base)
    mutate(ours)
    expect(sankeyAgreement(base, ours)).toEqual({ ...full, ...expected })
  })

  it('counts items ours lacks, and has no share with nothing to compare', () => {
    const none = parseSankeySvg('<svg viewBox="0 0 1 1"></svg>')
    expect(sankeyAgreement(base, none)).toMatchObject({
      bars: 0,
      labels: 0,
      ribbons: 0,
    })
    expect(sankeyAgreement(none, none)).toMatchObject({
      bars: null,
      labels: null,
      ribbons: null,
    })
  })
})

describe('sankeyBreaches', () => {
  it('lists samples under the floor and errored ones', () => {
    const ok = { bars: 1, labels: 1, ribbons: 1, frame: 1, nodes: 2 }
    const bad = { ...ok, labels: 0.5 }
    expect(worstSankey(bad)).toBe(0.5)
    expect(
      worstSankey({
        bars: null,
        labels: null,
        ribbons: null,
        frame: null,
        nodes: 0,
      }),
    ).toBeNull()
    expect(sankeyBreaches({ ok, bad }, ['boom'])).toEqual([
      'boom (error)',
      'bad (50% < 100%)',
    ])
    expect(sankeyBreaches({ ok })).toEqual([])
  })
})
