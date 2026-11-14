import { describe, it, expect } from 'vitest'
import { parseEventModeling } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG } from '../../../../src/index.ts'
import {
  layoutEventModeling,
  measure,
  wrapLabel,
} from '../eventmodeling/layout.ts'
import { ENTITY_COLORS } from '../eventmodeling/renderer.ts'

const layout = (src: string) => layoutEventModeling(parseEventModeling(src))

// The figures below are what Mermaid 12.3.0 draws for this source (pnpm run
// eventmodeling:oracle compares every sample against the real thing).
const SOURCE = `eventmodeling
tf 01 rmo Inventory.Stock
tf 02 ui ProductPage
tf 03 cmd AddItem { description: string }
tf 04 evt ItemAdded [[AddItem01]]
rf 05 evt External.InventoryChanged
tf 06 rmo CartUI ->> 04 ->> 05
data AddItem01 {
  description: 'john'
}
`

describe('event modeling layout (Mermaid 12.3.0 figures)', () => {
  const d = layout(SOURCE)

  it('draws the lanes in index order, one per namespaced frame', () => {
    expect(d.lanes.map((l) => [l.label, l.y, l.height])).toEqual([
      ['UI/Automation', 0, 130],
      ['Command/Read Model', 140, 130],
      ['C/RM: Inventory', 280, 130],
      ['Events', 420, 146],
      ['Stream: External', 576, 130],
    ])
    expect(d.viewBox).toEqual({ x: -30, y: -30, width: 1250, height: 766 })
    expect(d.laneWidth).toBe(1190)
  })

  it('sizes and places boxes from their text', () => {
    const [stock, page, add, added] = d.boxes
    expect([stock!.x, stock!.y, stock!.width, stock!.height]).toEqual([
      250, 295, 143, 100,
    ])
    expect([page!.x, page!.y, page!.width]).toEqual([323, 15, 195])
    expect(add!.x).toBe(448)
    expect(add!.width).toBeCloseTo(280.33, 1)
    expect(added!.height).toBe(116)
    expect(added!.dataLines).toEqual(["description: 'john'"])
  })

  it('points a frame at the nearest earlier frame of another lane, or at its sources', () => {
    expect(d.relations.map((r) => [r.from, r.to])).toEqual([
      [0, 1], // ProductPage <- Stock
      [1, 2], // AddItem <- ProductPage
      [2, 3], // ItemAdded <- AddItem
      [3, 5], // CartUI <- ItemAdded (rf 05 draws no arrow of its own)
      [4, 5], // CartUI <- InventoryChanged
    ])
    // Down from the bottom of the source to the top of the target.
    expect(d.relations[1]!.y1).toBe(d.boxes[1]!.y + d.boxes[1]!.height)
    expect(d.relations[1]!.y2).toBe(d.boxes[2]!.y)
  })

  it('draws an arrow up from the top of its source to the bottom of its target', () => {
    const up = layout('eventmodeling\ntf 01 evt A\ntf 02 ui B')
    const [r] = up.relations
    expect(r!.y1).toBe(up.boxes[0]!.y)
    expect(r!.y2).toBe(up.boxes[1]!.y + up.boxes[1]!.height)
  })

  it('draws no arrow for a first frame, a reset frame or a source that comes later', () => {
    expect(layout('eventmodeling\ntf 01 ui A').relations).toEqual([])
    expect(layout('eventmodeling\ntf 01 ui A\nrf 02 cmd B').relations).toEqual(
      [],
    )
    expect(
      layout('eventmodeling\ntf 01 ui A ->> 02\nrf 02 cmd B').relations,
    ).toEqual([])
    expect(
      layout('eventmodeling\ntf 01 ui A\ntf 02 cmd B ->> 02').relations,
    ).toHaveLength(1)
  })

  it('stacks boxes of one lane side by side and an empty diagram is 60px square', () => {
    const same = layout('eventmodeling\ntf 01 ui A\ntf 02 ui B')
    expect(same.boxes[1]!.x).toBe(same.boxes[0]!.x + same.boxes[0]!.width + 10)
    expect(layout('eventmodeling').viewBox).toEqual({
      x: -30,
      y: -30,
      width: 60,
      height: 60,
    })
  })

  it('wraps long data at 430px and breaks a name with a hyphen', () => {
    const wide = layout(
      `eventmodeling\ntf 01 ui ${'W'.repeat(60)}\ntf 02 cmd C { ${'word '.repeat(60)}}`,
    )
    expect(wide.boxes[0]!.nameLines.length).toBeGreaterThan(1)
    expect(wide.boxes[0]!.nameLines[0]).toMatch(/-$/)
    expect(wide.boxes[1]!.dataLines.length).toBeGreaterThan(1)
    expect(wide.boxes[1]!.width).toBeLessThanOrEqual(470)
  })

  it('keeps data with no content and unknown references out of the drawing', () => {
    const d2 = layout('eventmodeling\ntf 01 ui A "x"\ntf 02 ui B [[Nope]]')
    expect(d2.boxes.map((b) => b.dataLines)).toEqual([[], []])
  })
})

describe('wrapLabel and measure', () => {
  it('leaves text with a break, and empty text, alone', () => {
    expect(wrapLabel('a<br/>b', 50)).toBe('a<br/>b')
    expect(wrapLabel('', 50)).toBe('')
  })
  it('breaks at spaces, and hyphenates a word wider than the limit', () => {
    const out = wrapLabel('alpha beta gamma delta epsilon zeta', 90)
    expect(out.split('<br/>').length).toBeGreaterThan(1)
    expect(wrapLabel('x'.repeat(40), 90)).toMatch(/^x+-<br\/>/)
    expect(wrapLabel('x'.repeat(40) + ' y', 90).endsWith('y')).toBe(true)
  })
  it('measures bold text rounded, spaces collapsed', () => {
    expect(measure('  a   b ')).toBe(measure('a b'))
    expect(Number.isInteger(measure('Hello'))).toBe(true)
  })
})

describe('event modeling SVG', () => {
  const svg = renderMermaidSVG(SOURCE)

  it('draws lanes, boxes with Mermaid colours, arrows and an arrowhead', () => {
    expect(svg.match(/class="em-swimlane"/g)).toHaveLength(5)
    expect(svg.match(/class="em-box"/g)).toHaveLength(6)
    expect(svg.match(/class="em-relation"/g)).toHaveLength(5)
    expect(svg).toContain(`fill="${ENTITY_COLORS.event.fill}"`)
    expect(svg).toContain(`stroke="${ENTITY_COLORS.command.stroke}"`)
    expect(svg).toMatch(/marker-end="url\(#[\w-]*em-arrowhead\)"/)
    expect(svg).toContain('>Stream: External<')
  })

  it('writes data lines with unbreakable spaces', () => {
    expect(svg).toContain('description:\u00a0&#39;john&#39;')
  })

  it('is named by the title option and dropped when decorative', () => {
    expect(renderMermaidSVG(SOURCE, { title: 'Cart' })).toContain('Cart')
    expect(renderMermaidSVG(SOURCE, { decorative: true })).toContain(
      'aria-hidden="true"',
    )
  })

  it('draws an empty diagram', () => {
    expect(renderMermaidSVG('eventmodeling')).toContain('<svg')
  })
})
