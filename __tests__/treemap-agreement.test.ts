import { describe, expect, it } from 'vitest'
import {
  parseTreemapSvg,
  treemapAgreement,
  treemapBreaches,
  worstTreemap,
} from '../scripts/lib/treemap-agreement.ts'

/** Mermaid's markup: root hidden, tree under a translated container. */
const official = (w = 996, label = 'A', size = 38): string =>
  `<svg viewBox="2 27 ${w} 371"><g class="treemapContainer" transform="translate(0, 0)">` +
  `<g class="treemapSection" transform="translate(0,0)"><rect class="treemapSectionHeader" width="1000" height="25" style="display: none;"></rect><rect width="1000" height="400" class="treemapSection section0" style="display: none;"></rect><text class="treemapSectionLabel" style="display: none;"></text></g>` +
  `<g class="treemapSection" transform="translate(10,35)"><rect class="treemapSectionHeader" width="980" height="25" style=""></rect><rect width="980" height="355" class="treemapSection section1" style=";"></rect>` +
  `<text class="treemapSectionLabel" x="6" style="font-size: 12px;">R &amp; S</text><text class="treemapSectionValue" style="font-size: 10px;">5</text></g>` +
  `<g class="treemapNode treemapLeafGroup leaf0x" transform="translate(20,70)"><rect width="960" height="310" class="treemapLeaf"></rect>` +
  `<text class="treemapLabel" style="font-size: ${size}px;">${label}</text><text class="treemapValue" style="display: none;">5</text></g></g></svg>`

/** This renderer's markup: an offset group, the container beneath it. */
const ours = (w = 996, label = 'A', size = 38): string =>
  `<svg viewBox="0 0 ${w} 371"><g transform="translate(-2,-27)"><g class="treemapContainer" transform="translate(0,0)">` +
  `<g class="treemapSection" transform="translate(10,35)"><rect class="treemapSectionHeader" width="980" height="25"/><rect class="treemapSection tm-c1" width="980" height="355"/>` +
  `<text class="treemapSectionLabel" x="6" font-size="12">R &amp; S</text><text class="treemapSectionValue" font-size="10">5</text></g>` +
  `<g class="treemapNode treemapLeafGroup" transform="translate(20,70)"><rect class="treemapLeaf" width="960" height="310"/>` +
  `<text class="treemapLabel" font-size="${size}">${label}</text></g></g></g></svg>`

describe('parseTreemapSvg', () => {
  it('reads cells and shown texts relative to the viewBox, skipping the hidden root', () => {
    const l = parseTreemapSvg(official())
    expect(l.size).toEqual({ width: 996, height: 371 })
    expect(l.boxes).toEqual([
      { x: 8, y: 8, width: 980, height: 355 },
      { x: 18, y: 43, width: 960, height: 310 },
    ])
    expect(l.texts).toEqual([
      { kind: 'treemapSectionLabel', text: 'R & S', size: 12 },
      { kind: 'treemapSectionValue', text: '5', size: 10 },
      { kind: 'treemapLabel', text: 'A', size: 38 },
    ])
  })

  it('reads this renderer through its offset group', () => {
    expect(parseTreemapSvg(ours()).boxes).toEqual(
      parseTreemapSvg(official()).boxes,
    )
    expect(parseTreemapSvg(ours()).texts[0]).toEqual({
      kind: 'treemapSectionLabel',
      text: 'R & S',
      size: 12,
    })
  })

  it('tolerates a drawing with no viewBox, container or text size', () => {
    const l = parseTreemapSvg(
      '<svg><g class="treemapNode treemapLeafGroup" transform="translate(1,2)"><rect width="3" height="4"/><text class="treemapLabel">x</text></g></svg>',
    )
    expect(l.size).toBeUndefined()
    expect(l.boxes).toEqual([{ x: 1, y: 2, width: 3, height: 4 }])
    expect(l.texts).toEqual([{ kind: 'treemapLabel', text: 'x' }])
  })
})

describe('treemapAgreement', () => {
  it('is 1 across the board for identical drawings', () => {
    const a = treemapAgreement(
      parseTreemapSvg(official()),
      parseTreemapSvg(ours()),
    )
    expect(a).toEqual({ boxes: 1, texts: 1, frame: 1, cells: 2 })
    expect(worstTreemap(a)).toBe(1)
  })

  it('scores a different label size, text and frame', () => {
    const a = treemapAgreement(
      parseTreemapSvg(official()),
      parseTreemapSvg(ours(900, 'B', 30)),
    )
    expect(a.boxes).toBe(1)
    expect(a.texts).toBeCloseTo(2 / 3)
    expect(a.frame).toBe(0)
  })

  it('has nothing to compare for empty drawings', () => {
    const a = treemapAgreement(
      { boxes: [], texts: [] },
      { boxes: [], texts: [] },
    )
    expect(a).toEqual({ boxes: null, texts: null, frame: 0, cells: 0 })
    expect(worstTreemap(a)).toBe(0)
    expect(
      worstTreemap({ boxes: null, texts: null, frame: null, cells: 0 }),
    ).toBeNull()
  })
})

describe('treemapBreaches', () => {
  it('lists errored samples and ones under the floor', () => {
    const ok = { boxes: 1, texts: 0.96, frame: 1, cells: 1 }
    const low = { boxes: 1, texts: 0.5, frame: 1, cells: 1 }
    expect(treemapBreaches({ ok, low }, ['bad'])).toEqual([
      'bad (error)',
      'low (50% < 95%)',
    ])
    expect(treemapBreaches({ ok })).toEqual([])
  })
})
