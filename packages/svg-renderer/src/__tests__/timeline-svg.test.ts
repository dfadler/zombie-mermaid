/**
 * Timeline layout and SVG. Geometry expectations are measured from
 * mermaid@12.3.0 (identical to 12.2.0) rendering the same sources; the full
 * comparison runs in scripts/timeline-oracle.ts.
 */
import { describe, it, expect } from 'vitest'
import { parseTimeline } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG } from '../index.ts'
import {
  layoutTimeline,
  spannedLines,
  textWidth,
  wrapTimelineText,
} from '../timeline/layout.ts'

const layout = (src: string) => layoutTimeline(parseTimeline(src))

describe('wrapTimelineText', () => {
  it('keeps short text on one line and wraps at 150px', () => {
    expect(wrapTimelineText('Short text', 150)).toEqual(['Short text'])
    expect(wrapTimelineText('Loses American colonies', 150)).toEqual([
      'Loses American',
      'colonies',
    ])
  })

  it('breaks on <br>', () => {
    expect(wrapTimelineText('one<br>two', 150)).toEqual(['one', 'two'])
  })

  it('leaves an empty first line before a word wider than the box', () => {
    const lines = wrapTimelineText(
      'Supercalifragilisticexpialidocious_and_more',
      150,
    )
    expect(lines[0]).toBe('')
    expect(lines[1]).toContain('Supercali')
    expect(spannedLines(lines)).toBe(1)
  })

  it('measures wide characters as a full em', () => {
    expect(textWidth('日')).toBe(16)
  })
})

describe('layoutTimeline – left to right', () => {
  it("matches mermaid's boxes for periods without sections", () => {
    const l = layout('timeline\n2002 : LinkedIn\n2004 : Facebook : Google')
    expect(
      l.nodes.map((n) => [n.kind, n.x, n.y, n.width, n.height, n.colorClass]),
    ).toEqual([
      ['period', 100, 50, 190, 67.8, -1],
      ['event', 100, 250, 190, 50, -1],
      ['period', 300, 50, 190, 67.8, 0],
      ['event', 300, 250, 190, 50, 0],
      ['event', 300, 310, 190, 50, 0],
    ])
    // The viewBox is the content plus 50px, origin moved to 0,0.
    expect(l.width).toBe(790)
    expect(l.axis.y2).toBe(l.axis.y1)
  })

  it('spans a section heading over its columns and shares one colour', () => {
    const l = layout('timeline\nsection A\n1 : a\n2 : b\nsection B\n3 : c')
    const [h1, h2] = l.nodes.filter((n) => n.kind === 'section')
    expect(h1!.width).toBe(390)
    expect(h2!.width).toBe(190)
    expect(
      l.nodes.filter((n) => n.kind === 'period').map((n) => n.colorClass),
    ).toEqual([-1, -1, 0])
  })

  it('keeps a running maximum of period heights within a section', () => {
    const l = layout(
      'timeline\nsection S\nshort\nA very long period label that wraps across several lines of text\nlast',
    )
    const heights = l.nodes
      .filter((n) => n.kind === 'period')
      .map((n) => n.height)
    expect(heights[0]).toBe(67.8)
    expect(heights[1]).toBeCloseTo(100.6, 1)
    expect(heights[2]).toBeCloseTo(100.6, 1)
  })

  it('wraps colours after twelve sections', () => {
    const src =
      'timeline\n' +
      Array.from({ length: 13 }, (_, i) => `section S${i}\np${i}`).join('\n')
    const heads = layout(src).nodes.filter((n) => n.kind === 'section')
    expect(heads[11]!.colorClass).toBe(10)
    expect(heads[12]!.colorClass).toBe(-1)
  })

  it('draws no period that is outside every section when sections exist', () => {
    const l = layout('timeline\norphan : e\nsection S\na : b')
    expect(l.nodes.map((n) => n.lines[0])).toEqual(['S', 'a', 'b'])
  })

  it('draws only the axis for a bare timeline', () => {
    const l = layout('timeline')
    expect(l.nodes).toEqual([])
    expect(l.connectors).toEqual([])
    expect(l.axis.x2 - l.axis.x1).toBe(300)
  })

  it('places the title at half the content width minus 150', () => {
    const l = layout('timeline\ntitle T\n1 : a\n2 : b')
    expect(l.title?.y).toBeGreaterThan(0)
    expect(l.title?.text).toBe('T')
  })
})

describe('layoutTimeline – top to bottom', () => {
  it("matches mermaid's boxes", () => {
    const l = layout('timeline TD\nsection S\n1 : a : b\n2')
    expect(l.direction).toBe('TD')
    const periods = l.nodes.filter((n) => n.kind === 'period')
    const events = l.nodes.filter((n) => n.kind === 'event')
    expect(periods.map((n) => n.width)).toEqual([210, 210])
    expect(events.map((n) => n.width)).toEqual([310, 310])
    // Events sit 10px apart beside their period; every period is one row apart.
    expect(events[1]!.y - events[0]!.y).toBeCloseTo(events[0]!.height + 10, 5)
    expect(periods[1]!.y - periods[0]!.y).toBeCloseTo(
      Math.max(32.8, 2 * events[0]!.height + 10) + 30,
      5,
    )
    expect(l.connectors).toHaveLength(2)
    expect(l.axis.x1).toBe(l.axis.x2)
  })
})

describe('renderMermaidSVG – timeline', () => {
  const svg = renderMermaidSVG(
    'timeline\ntitle History\nsection S\n1 : a <b> & c\n2',
  )

  it('draws Mermaid’s structure', () => {
    expect(svg).toContain('class="taskWrapper"')
    expect(svg).toContain('class="eventWrapper"')
    expect(svg).toContain('class="sectionWrapper"')
    expect(svg).toContain('class="lineWrapper"')
    expect(svg).toContain('stroke-dasharray="5,5"')
    expect(svg).toMatch(/marker-end="url\(#[\w-]*timeline-arrowhead\)"/)
  })

  it('escapes text and draws the title', () => {
    expect(svg).toContain('a &lt;b&gt; &amp; c')
    expect(svg).toContain('class="timeline-title"')
    expect(svg).toContain('>History</text>')
  })

  it('draws no arrowheads for timeline TD, as Mermaid does', () => {
    const td = renderMermaidSVG('timeline TD\n1 : a')
    expect(td).not.toContain('marker-end')
    expect(td).not.toContain('timeline-arrowhead')
  })

  it('names the accessible title from options', () => {
    expect(
      renderMermaidSVG('timeline\n1 : a', { title: 'My timeline' }),
    ).toContain('My timeline')
  })

  it('colours boxes from the theme accent', () => {
    const themed = renderMermaidSVG('timeline\n1 : a\n2 : b', {
      accent: '#ff0000',
    })
    expect(themed).toContain('--timeline-color-0: var(--accent')
    expect(themed).toContain('.section--1 path')
  })
})
