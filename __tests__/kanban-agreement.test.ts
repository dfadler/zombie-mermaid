import { describe, expect, it } from 'vitest'
import { renderMermaidSVG } from '../src/index.ts'
import {
  kanbanAgreement,
  kanbanBreaches,
  parseKanbanSvg,
} from '../scripts/lib/kanban-agreement.ts'

// Trimmed from mermaid 12.3.0's render of `kanban\n  A\n    [One]@{ priority: 'High' }`.
const OFFICIAL = `<svg viewBox="90 -310 220 99"><g class="sections"><g class="cluster undefined section-1" id="k-A"><rect rx="5" ry="5" x="100" y="-300" width="200" height="79"></rect></g></g><g class="items"><g class="node undefined" id="k-a" transform="translate(200, -253)"><rect class="basic label-container __APA__" rx="5" ry="5" x="-92.5" y="-22" width="185" height="44"></rect><line x1="-90.5" y1="-20" x2="-90.5" y2="20" stroke-width="4" stroke="orange"></line></g></g></svg>`
const SOURCE = "kanban\n  A\n    a[One]@{ priority: 'High' }"

describe('parseKanbanSvg', () => {
  it('reads rectangles relative to the viewBox, bars and the size', () => {
    expect(parseKanbanSvg(OFFICIAL)).toEqual({
      columns: [{ x: 10, y: 10, width: 200, height: 79 }],
      cards: [{ x: 17.5, y: 35, width: 185, height: 44 }],
      bars: ['orange'],
      size: { width: 220, height: 99 },
    })
  })

  it('reads our own markup to the same figures', () => {
    expect(parseKanbanSvg(renderMermaidSVG(SOURCE))).toEqual(
      parseKanbanSvg(OFFICIAL),
    )
  })
})

describe('kanbanAgreement', () => {
  const base = () => parseKanbanSvg(OFFICIAL)

  it('is 1 for identical layouts and null with nothing to compare', () => {
    expect(kanbanAgreement(base(), base())).toEqual({
      columns: 1,
      cards: 1,
      bars: 1,
      frame: 1,
    })
    const empty = { columns: [], cards: [], bars: [], size: base().size }
    expect(kanbanAgreement(empty, empty)).toMatchObject({
      columns: null,
      cards: null,
      bars: null,
    })
  })

  it('notices a taller card, another bar colour and a different size', () => {
    const ours = base()
    ours.cards[0]!.height += 24
    ours.bars[0] = 'red'
    ours.size.width += 5
    expect(kanbanAgreement(base(), ours)).toEqual({
      columns: 1,
      cards: 0,
      bars: 0,
      frame: 0,
    })
  })

  it('counts a missing card against the share', () => {
    const ours = base()
    ours.cards = []
    expect(kanbanAgreement(base(), ours).cards).toBe(0)
  })
})

describe('kanbanBreaches', () => {
  it('lists samples under 100% and the errored ones', () => {
    const ok = { columns: 1, cards: 1, bars: null, frame: 1 }
    expect(kanbanBreaches({ a: ok, b: { ...ok, cards: 0.5 } }, ['c'])).toEqual([
      'b',
      'c',
    ])
  })
})

describe('parseKanbanSvg on sparse markup', () => {
  it('treats a missing viewBox, transform and attributes as zero', () => {
    const svg =
      '<svg><g class="cluster"><rect></rect></g><g class="node"><rect class="basic"></rect></g></svg>'
    expect(parseKanbanSvg(svg)).toEqual({
      columns: [{ x: 0, y: 0, width: 0, height: 0 }],
      cards: [{ x: 0, y: 0, width: 0, height: 0 }],
      bars: [''],
      size: { width: 0, height: 0 },
    })
  })

  it('reads a bar with no stroke as "-"', () => {
    const svg =
      '<svg viewBox="0 0 1 1"><g class="node" transform="translate(1, 2)"><rect class="basic" x="0" y="0" width="1" height="1"></rect><line stroke-width="4"></line></g></svg>'
    expect(parseKanbanSvg(svg).bars).toEqual(['-'])
  })
})
