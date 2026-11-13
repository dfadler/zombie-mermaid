import { describe, expect, it } from 'vitest'
import { renderMermaidSVG } from '../src/index.ts'
import {
  journeyAgreement,
  journeyBreaches,
  parseJourneySvg,
  worstJourney,
  type JourneyLayout,
} from '../scripts/lib/journey-agreement.ts'

// Trimmed from mermaid 12.3.0's render of `journey\n title T\n section S\n a: 5: Me, Cat`.
const OFFICIAL = `<svg viewBox="0 -25 500 540"><circle cx="20" cy="55" class="actor-0" r="7"></circle><g><rect x="150" y="50" width="150" height="50" class="journey-section section-type-0"></rect><text class="journey-section section-type-0"></text></g><g><line id="j0-task0" x1="225" y1="110" x2="225" y2="450" class="task-line" stroke-width="1px"></line><circle cx="225" cy="300" class="face" r="15"></circle><rect x="150" y="110" width="150" height="50" class="task task-type-0"></rect><circle cx="164" cy="110" class="actor-1" r="7"></circle><circle cx="174" cy="110" class="actor-0" r="7"></circle></g><line x1="150" y1="200" x2="346" y2="200" stroke-width="4" marker-end="url(#a)"></line></svg>`

describe('parseJourneySvg', () => {
  it('reads elements relative to the viewBox origin', () => {
    const l = parseJourneySvg(OFFICIAL)
    expect(l.sections).toEqual([
      { x: 150, y: 75, width: 150, height: 50, type: '0' },
    ])
    expect(l.tasks).toEqual([
      { x: 150, y: 135, width: 150, height: 50, type: '0' },
    ])
    expect(l.faces).toEqual([{ x: 225, y: 325, type: 'face' }])
    expect(l.lines).toEqual([{ x1: 225, y1: 135, x2: 225, y2: 475 }])
    expect(l.dots.map((d) => d.type)).toEqual(['actor-0', 'actor-1', 'actor-0'])
    expect(l.axis).toEqual({ x1: 150, y1: 225, x2: 346, y2: 225 })
    expect(l.size).toEqual({ width: 500, height: 540 })
  })

  it('reads our own markup', () => {
    const l = parseJourneySvg(
      renderMermaidSVG('journey\nsection S\n a: 5: Me, Cat'),
    )
    expect(l.sections).toHaveLength(1)
    expect(l.tasks).toHaveLength(1)
    expect(l.faces).toHaveLength(1)
    expect(l.lines).toHaveLength(1)
    expect(l.dots).toHaveLength(4)
    expect(l.axis).toBeDefined()
  })
})

describe('journeyAgreement', () => {
  const base = (): JourneyLayout => parseJourneySvg(OFFICIAL)

  it('is 1 for identical layouts and null where nothing is drawn', () => {
    const a = journeyAgreement(base(), base())
    expect(a).toMatchObject({
      sections: 1,
      tasks: 1,
      faces: 1,
      lines: 1,
      dots: 1,
      frame: 1,
    })
    const e: JourneyLayout = {
      sections: [],
      tasks: [],
      faces: [],
      lines: [],
      dots: [],
    }
    const none = journeyAgreement(e, e)
    expect(none.sections).toBeNull()
    expect(worstJourney(none)).toBe(0) // Frame is 0 without an axis
  })

  it('counts moved boxes, faces, lines and dots, ignoring sub-half-pixel noise', () => {
    const ours = base()
    ours.sections[0]!.x += 0.3
    ours.tasks[0]!.width += 5
    ours.faces[0]!.y += 10
    ours.lines[0]!.y2 += 10
    ours.dots[2]!.x += 10
    const a = journeyAgreement(base(), ours)
    expect(a).toMatchObject({ sections: 1, tasks: 0, faces: 0, lines: 0 })
    expect(a.dots).toBeCloseTo(2 / 3)
  })

  it('counts a missing element as a disagreement', () => {
    const ours = base()
    ours.dots.pop()
    expect(journeyAgreement(base(), ours).dots).toBeCloseTo(2 / 3)
  })

  it('compares actor colour slots mod 6 and ignores a NaN official coordinate', () => {
    const o = base()
    const t = base()
    o.dots[0]!.type = 'actor-6'
    o.faces[0]!.y = NaN
    expect(journeyAgreement(o, t)).toMatchObject({ dots: 1, faces: 1 })
    o.dots[0]!.type = 'actor-7'
    expect(journeyAgreement(o, t).dots).toBeCloseTo(2 / 3)
  })

  it('fails the frame when the size or axis differs', () => {
    const size = base()
    size.size!.width += 10
    expect(journeyAgreement(base(), size).frame).toBe(0)
    const axis = base()
    axis.axis!.x2 += 10
    expect(journeyAgreement(base(), axis).frame).toBe(0)
  })
})

describe('journeyBreaches', () => {
  const ok = {
    sections: 1,
    tasks: 1,
    faces: 1,
    lines: 1,
    dots: 1,
    frame: 1,
    items: 2,
  }
  it('names samples under the floor and errored ones', () => {
    expect(journeyBreaches({ a: ok, b: { ...ok, faces: 0.5 } }, ['c'])).toEqual(
      ['c (error)', 'b (50% < 100%)'],
    )
    expect(journeyBreaches({ a: ok })).toEqual([])
  })
})
