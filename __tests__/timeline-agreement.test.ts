import { describe, expect, it } from 'vitest'
import { renderMermaidSVG } from '../src/index.ts'
import {
  parseTimelineSvg,
  summarizeTimeline,
  timelineAgreement,
  timelineBreaches,
  worstTimeline,
  type TimelineLayout,
} from '../scripts/lib/timeline-agreement.ts'

// Trimmed from mermaid 12.3.0's render of `timeline\n 2002 : LinkedIn\n 2004 : a &amp; b : Google`.
const OFFICIAL = `<svg viewBox="100 0 590 400"><g></g><g class="taskWrapper" transform="translate(200, 50)"><g class="timeline-node section--1"><g><path class="node-bkg node-undefined" d="M0 62.8 v-57.8 q0,-5,5,-5 h180 q5,0,5,5 v62.8 H0 Z"></path><line class="node-line--1" x1="0" y1="67.8" x2="190" y2="67.8"></line></g><g transform="translate(95, 10)"><text dy="1em"><tspan x="0" dy="1em">2002</tspan></text></g></g></g><g class="lineWrapper"><line x1="295" y1="117.8" x2="295" y2="423.4" stroke-width="2" stroke="black" marker-end="url(#a)" stroke-dasharray="5,5"></line></g><g class="eventWrapper" transform="translate(200, 250)"><g class="timeline-node section--1"><g><path d=""></path><line class="node-line--1" x1="0" y1="65.4" x2="190" y2="65.4"></line></g><g transform="translate(95, 10)"><text dy="1em"><tspan x="0" dy="1em">a   &amp;</tspan><tspan x="0" dy="1.1em">b</tspan><tspan x="0" dy="1.1em"></tspan></text></g></g></g><g class="lineWrapper"><line x1="150" y1="285.6" x2="690" y2="285.6" stroke-width="4" stroke="black" marker-end="url(#a)"></line></g></svg>`

describe('parseTimelineSvg', () => {
  it('reads boxes relative to the viewBox, lines, connectors, axis and size', () => {
    const l = parseTimelineSvg(OFFICIAL)
    expect(l.nodes).toEqual([
      { kind: 'period', x: 100, y: 50, height: 67.8, lines: ['2002'] },
      { kind: 'event', x: 100, y: 250, height: 65.4, lines: ['a &', 'b'] },
    ])
    expect(l.connectors).toEqual([{ x1: 195, y1: 117.8, x2: 195, y2: 423.4 }])
    expect(l.axis).toEqual({ x1: 50, y1: 285.6, x2: 590, y2: 285.6 })
    expect(l.size).toEqual({ width: 590, height: 400 })
  })

  it('reads our own markup, sections included', () => {
    const l = parseTimelineSvg(renderMermaidSVG('timeline\nsection S\n1 : a'))
    expect(l.nodes.map((n) => n.kind)).toEqual(['section', 'period', 'event'])
    expect(l.connectors).toHaveLength(1)
    expect(l.axis).toBeDefined()
  })
})

describe('timelineAgreement', () => {
  const base = (): TimelineLayout => parseTimelineSvg(OFFICIAL)

  it('is 1 for identical layouts', () => {
    const a = timelineAgreement(base(), base())
    expect(a).toMatchObject({
      boxes: 1,
      lines: 1,
      connectors: 1,
      frame: 1,
      nodes: 2,
    })
    expect(worstTimeline(a)).toBe(1)
  })

  it('counts a moved or resized box, ignoring sub-half-pixel noise', () => {
    const ours = base()
    ours.nodes[0]!.x += 0.3
    ours.nodes[1]!.height += 5
    expect(timelineAgreement(base(), ours).boxes).toBe(0.5)
  })

  it('counts different wrapped lines', () => {
    const ours = base()
    ours.nodes[1]!.lines = ['a & b']
    expect(timelineAgreement(base(), ours).lines).toBe(0.5)
  })

  it('counts a missing node and a moved connector as disagreements', () => {
    const ours = base()
    ours.nodes.pop()
    ours.connectors[0]!.y2 += 10
    const a = timelineAgreement(base(), ours)
    expect(a.boxes).toBe(0.5)
    expect(a.connectors).toBe(0)
  })

  it('fails the frame when the size or axis differs', () => {
    const a = base()
    const size = base()
    size.size!.width += 10
    expect(timelineAgreement(a, size).frame).toBe(0)
    const axis = base()
    axis.axis!.x2 += 10
    expect(timelineAgreement(a, axis).frame).toBe(0)
    const none = base()
    delete none.axis
    expect(timelineAgreement(a, none).frame).toBe(0)
  })

  it('has nothing to compare for an empty diagram', () => {
    const e: TimelineLayout = { nodes: [], connectors: [] }
    const a = timelineAgreement(e, e)
    expect(a.boxes).toBeNull()
    expect(worstTimeline(a)).toBe(0)
  })
})

describe('summaries', () => {
  const ok = { boxes: 1, lines: 1, connectors: 1, frame: 1, nodes: 2 }
  const bad = { boxes: 0.5, lines: 1, connectors: null, frame: 1, nodes: 2 }

  it('averages figures and names breaches', () => {
    const entry = summarizeTimeline(
      { a: ok, b: bad },
      { date: '2026-11-06', commit: 'abc', mermaid: '12.3.0' },
    )
    expect(entry).toMatchObject({
      kind: 'timeline',
      samples: 2,
      boxes: 0.75,
      connectors: 1,
    })
    expect(timelineBreaches({ a: ok, b: bad }, ['c'])).toEqual([
      'c (error)',
      'b (50% < 100%)',
    ])
    expect(timelineBreaches({ a: ok })).toEqual([])
  })
})
