import { describe, expect, it, vi } from 'vitest'
import { renderMermaidSVG } from '../src/index.ts'
import { scoreEventModeling } from '../scripts/lib/eventmodeling-measure.ts'
import type { RealMermaidSession } from '../scripts/lib/real-mermaid.ts'
import {
  emAgreement,
  emBreaches,
  parseEmSvg,
} from '../scripts/lib/eventmodeling-agreement.ts'

// Trimmed from mermaid 12.3.0's render of `eventmodeling\ntf 01 ui A\ntf 02 cmd B`.
const OFFICIAL = `<svg viewBox="-30 -30 447 330"><g class="em-swimlane"><rect x="0" y="0" rx="3" width="387" height="130" fill="rgb(250,250,250)"></rect><text font-weight="bold" x="30" y="30">UI/Automation</text></g><g class="em-box"><rect x="250" y="15" rx="3" width="100" height="100" stroke="#dbdada" fill="white"></rect></g><path class="em-relation" fill="none" stroke="#000" stroke-width="1" marker-end="url(#em-arrowhead-x)" d="M317.5 115 L330.5 155"></path></svg>`
const SOURCE = 'eventmodeling\ntf 01 ui A'

describe('parseEmSvg', () => {
  it('reads lanes, boxes, arrows and the size', () => {
    expect(parseEmSvg(OFFICIAL)).toEqual({
      lanes: [{ x: 0, y: 0, width: 387, height: 130, label: 'UI/Automation' }],
      boxes: [{ x: 250, y: 15, width: 100, height: 100 }],
      arrows: [[317.5, 115, 330.5, 155]],
      size: { width: 447, height: 330 },
    })
  })

  it('reads our own markup into the same shape', () => {
    const ours = parseEmSvg(renderMermaidSVG(SOURCE))
    expect(ours.lanes[0]!.label).toBe('UI/Automation')
    expect(ours.boxes).toHaveLength(1)
    expect(ours.size.width).toBeGreaterThan(0)
  })

  it('treats missing attributes as zero', () => {
    expect(
      parseEmSvg(
        '<svg><g class="em-swimlane"><rect></rect><text>x</text></g><g class="em-box"><rect></rect></g><path class="em-relation"></path></svg>',
      ),
    ).toEqual({
      lanes: [{ x: 0, y: 0, width: 0, height: 0, label: 'x' }],
      boxes: [{ x: 0, y: 0, width: 0, height: 0 }],
      arrows: [[0, 0, 0, 0]],
      size: { width: 0, height: 0 },
    })
  })
})

describe('emAgreement', () => {
  const base = () => parseEmSvg(OFFICIAL)

  it('is 1 for identical layouts and null with nothing to compare', () => {
    expect(emAgreement(base(), base())).toEqual({
      lanes: 1,
      boxes: 1,
      arrows: 1,
      frame: 1,
    })
    const empty = { lanes: [], boxes: [], arrows: [], size: base().size }
    expect(emAgreement(empty, empty)).toMatchObject({
      lanes: null,
      boxes: null,
      arrows: null,
    })
  })

  it('notices a moved box, another lane label, a moved arrow and a different size', () => {
    const ours = base()
    ours.boxes[0]!.height += 19
    ours.lanes[0]!.label = 'Events'
    ours.arrows[0]![3] += 5
    ours.size.width += 9
    expect(emAgreement(base(), ours)).toEqual({
      lanes: 0,
      boxes: 0,
      arrows: 0,
      frame: 0,
    })
  })

  it('allows a pixel of text-measurement drift in a box width', () => {
    const ours = base()
    ours.boxes[0]!.width += 1
    expect(emAgreement(base(), ours).boxes).toBe(1)
  })

  it('counts a missing box against the share', () => {
    const ours = base()
    ours.boxes = []
    expect(emAgreement(base(), ours).boxes).toBe(0)
  })
})

describe('emBreaches', () => {
  it('lists samples under 100% and the errored ones', () => {
    const ok = { lanes: 1, boxes: 1, arrows: null, frame: 1 }
    expect(emBreaches({ a: ok, b: { ...ok, boxes: 0.5 } }, ['c'])).toEqual([
      'b',
      'c',
    ])
  })
})

describe('scoreEventModeling', () => {
  // A stand-in session whose "official" render is our own, so every sample agrees.
  const session = {
    page: {
      evaluate: async (_fn: unknown, [, src]: [string, string]) =>
        renderMermaidSVG(src),
    },
  } as unknown as RealMermaidSession

  it('scores each event modeling sample and filters by title', async () => {
    const all = await scoreEventModeling(session)
    const titles = Object.keys(all.results)
    expect(titles.length).toBeGreaterThan(0)
    expect(all.breaches).toEqual([])
    const one = await scoreEventModeling(session, titles[0]!.toUpperCase())
    expect(Object.keys(one.results)).toContain(titles[0])
  })

  it('reports a sample that fails to render as errored', async () => {
    const bad = {
      page: {
        evaluate: async () => {
          throw new Error('boom\nstack')
        },
      },
    } as unknown as RealMermaidSession
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await scoreEventModeling(bad)
    spy.mockRestore()
    expect(r.errored.length).toBeGreaterThan(0)
    expect(r.breaches).toEqual(r.errored)
  })
})
