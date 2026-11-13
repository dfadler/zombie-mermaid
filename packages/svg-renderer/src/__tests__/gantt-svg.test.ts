/**
 * Gantt SVG: Mermaid's geometry (ganttRenderer.js defaults, mermaid@12.3.0),
 * checked against numbers from a real Mermaid render of the same source at
 * width 1264 (scripts/gantt-oracle.ts compares every sample the same way),
 * plus the renderer's structure, colours and accessibility.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { __resetSvgTitleIdCounterForTests } from '@zombie-mermaid/core'
import { parseGantt } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG } from '../../../../src/index.ts'
import { GANTT, layoutGantt } from '../gantt/layout.ts'

beforeEach(() => {
  __resetSvgTitleIdCounterForTests()
})

const NOW = new Date(Date.UTC(2014, 0, 10))
const lay = (src: string, width = 1264, now = NOW.getTime()) =>
  layoutGantt(parseGantt(src, NOW), { width, now })

const STATUS = `gantt
    dateFormat  YYYY-MM-DD
    title       Adding GANTT diagram functionality to mermaid
    excludes    weekends
    todayMarker off
    section A section
    Completed task            :done,    des1, 2014-01-06,2014-01-08
    Active task               :active,  des2, 2014-01-09, 3d
    Future task               :         des3, after des2, 5d
    section Critical tasks
    Completed task in the critical line :crit, done, 2014-01-06,24h
    Add to mermaid                      :until isadded
    Functionality added                 :milestone, isadded, 2014-01-25, 0d`

describe('gantt layout: Mermaid geometry', () => {
  const l = lay(STATUS)
  const bar = (id: string) => l.tasks.find((t) => t.id === id)!

  it('sizes the frame from the rows and the width', () => {
    expect(l.width).toBe(1264)
    expect(l.height).toBe(2 * 50 + 6 * 24)
    expect(l.title).toEqual({
      text: 'Adding GANTT diagram functionality to mermaid',
      x: 632,
      y: 25,
    })
  })

  it('places bars on the rounded time scale, rows 24px apart', () => {
    expect([bar('des1').x, bar('des1').y]).toEqual([75, 50])
    expect(bar('des2').y).toBe(74)
    expect(bar('des2').x).toBeGreaterThan(bar('des1').x)
    expect(bar('isadded').width).toBe(GANTT.barHeight)
  })

  it('shades each weekend run, but not one still open at the last day', () => {
    expect(l.excludeRanges.map((e) => e.id).slice(0, 2)).toEqual([
      '2014-01-11',
      '2014-01-18',
    ])
    expect(l.excludeRanges[0]).toMatchObject({
      y: 35,
      height: l.height - 50 - 35,
    })
  })

  it('builds the axis from d3 ticks, half a pixel off the scale', () => {
    const [axis] = l.axes
    expect(axis).toMatchObject({ position: 'bottom', x: 75, y: l.height - 50 })
    expect(axis!.ticks[0]).toMatchObject({ label: '2014-01-07' })
    expect(axis!.ticks[0]!.x % 1).toBe(0.5)
    expect(axis!.tickSize).toBe(-l.height + 50 + 35)
  })

  it('centres a section label on its rows', () => {
    expect(l.sectionLabels.map((s) => [s.lines[0], s.y])).toEqual([
      ['A section', (3 * 24) / 2 + 50],
      ['Critical tasks', (3 * 24) / 2 + 3 * 24 + 50],
    ])
  })

  it('places a label inside its bar, or beside it when it overflows', () => {
    expect(bar('des2').text).toMatchObject({ anchor: 'middle', outside: null })
    const wide = lay(
      'gantt\ndateFormat YYYY-MM-DD\nA very long task label indeed :a, 2024-01-01, 1d\nB :b, 2024-01-01, 60d',
    )
    expect(wide.tasks[0]!.text.outside).toBe('right')
    expect(wide.tasks[0]!.text.anchor).toBe('start')
    const edge = lay(
      'gantt\ndateFormat YYYY-MM-DD\nA :a, 2024-01-01, 60d\nA very long task label indeed :b, 2024-02-28, 1d',
      400,
    )
    expect(edge.tasks.find((t) => t.id === 'b')!.text).toMatchObject({
      outside: 'left',
      anchor: 'end',
    })
  })
})

describe('gantt layout: modes', () => {
  it('packs sections onto shared rows in compact mode', () => {
    const l = lay(`%%{init: {"gantt": {"displayMode": "compact"}}}%%
gantt
dateFormat YYYY-MM-DD
section S
A :a, 2024-01-01, 2d
B :b, 2024-01-01, 2d
C :c, 2024-01-03, 2d
section T
D :d, 2024-01-01, 1d`)
    expect(l.height).toBe(100 + 3 * 24)
    const y = Object.fromEntries(l.tasks.map((t) => [t.id, t.y]))
    expect(y).toEqual({ a: 50, b: 74, c: 50, d: 98 })
    expect(l.rows).toHaveLength(3)
    expect(l.sectionLabels[0]!.y).toBe((2 * 24) / 2 + 50)
  })

  it('sizes a vert marker from the packed rows in compact mode', () => {
    const l = lay(`%%{init: {"gantt": {"displayMode": "compact"}}}%%
gantt
dateFormat YYYY-MM-DD
A :a, 2024-01-01, 1d
B :b, 2024-01-03, 1d
C :c, 2024-01-05, 1d
V :vert, v, 2024-01-04, 0d`)
    const v = l.tasks.find((t) => t.id === 'v')!
    expect(l.height).toBe(100 + 24)
    expect(v.height).toBe(24 + 40)
    expect(v.y + v.height).toBeLessThan(l.height)
  })

  it('draws a vert marker through all rows and a milestone as a square', () => {
    const l = lay(`gantt
dateFormat YYYY-MM-DD
A :a, 2024-01-01, 10d
M :milestone, m, 2024-01-05, 0d
V :vert, v, 2024-01-08, 0d`)
    const v = l.tasks.at(-1)!
    expect(v).toMatchObject({ id: 'v', y: 35, width: 1.6, height: 2 * 24 + 40 })
    expect(v.text.y).toBe(35 + 2 * 24 + 60)
    expect(l.rows).toHaveLength(2)
    expect(l.tasks.find((t) => t.id === 'm')!.width).toBe(20)
    expect(l.sectionLabels).toHaveLength(1)
  })

  it('adds a top axis, custom ticks, the day-of-month default and drops absurd intervals', () => {
    const top = lay(
      'gantt\ndateFormat YYYY-MM-DD\ntopAxis\ntickInterval 1week\nA :a, 2024-01-01, 20d',
    )
    expect(top.axes.map((a) => a.position)).toEqual(['bottom', 'top'])
    expect(top.axes[1]!.y).toBe(50)
    expect(top.axes[0]!.ticks).toHaveLength(3)
    expect(
      lay('gantt\ndateFormat D\nA :a, 1, 3d').axes[0]!.ticks[0]!.label,
    ).toMatch(/^\d\d$/)
    const dense = lay(
      'gantt\ndateFormat YYYY-MM-DD\ntickInterval 1millisecond\nA :a, 2024-01-01, 400d',
    )
    expect(dense.axes[0]!.ticks.length).toBeLessThan(40)
  })

  it('handles empty and degenerate charts', () => {
    const empty = lay('gantt\ntitle T')
    expect(empty.height).toBe(100)
    expect(empty.axes[0]!.ticks).toEqual([])
    expect(empty.today).toBeUndefined()
    const point = lay(
      'gantt\ndateFormat YYYY-MM-DD\nM :milestone, m, 2024-01-05, 0d',
    )
    expect(point.tasks[0]!.x).toBe(75 + (1264 - 150) / 2 - 10)
  })

  it('draws today only while it is inside the chart, and honours the marker', () => {
    const src = 'gantt\ndateFormat YYYY-MM-DD\nA :a, 2014-01-01, 30d'
    const t = lay(src).today!
    expect(t).toMatchObject({ y1: 25, style: '' })
    expect(lay(src, 1264, Date.UTC(2020, 0, 1)).today).toBeUndefined()
    expect(lay(`${src}\ntodayMarker off`).today).toBeUndefined()
    expect(
      lay(`${src}\ntodayMarker stroke-width:5px,stroke:#0f0`).today!.style,
    ).toBe('stroke-width:5px;stroke:#0f0')
    expect(layoutGantt(parseGantt(src, NOW)).width).toBe(1200)
  })
})

describe('gantt SVG', () => {
  const SRC = `gantt
    title Plan <1>
    dateFormat YYYY-MM-DD
    todayMarker off
    excludes weekends
    section Build<br/>Phase
    Code :done, crit, a, 2024-01-02, 6d
    Test :active, b, after a, 4d
    Ship :milestone, c, 2024-01-20, 0d
    Mark :vert, v, 2024-01-15, 0d
    Plain :crit, p, 2024-01-03, 2d
    click b href "https://example.com"`

  it('renders Mermaid structure and classes', () => {
    const svg = renderMermaidSVG(SRC)
    expect(svg).toMatch(/^<svg /)
    expect(svg).toContain('class="titleText">Plan &lt;1&gt;</text>')
    expect(svg).toMatch(
      /<rect data-date="2024-01-06"[^>]*class="exclude-range"/,
    )
    expect(svg).toContain('class="task doneCrit0"')
    expect(svg).toContain('class="task active0 clickable"')
    expect(svg).toContain('class="task milestone  task0"')
    expect(svg).toContain('class="task vert  task0"')
    expect(svg).toContain('class="task crit0"')
    expect(svg).toMatch(
      /<tspan alignment-baseline="central" x="10">Build<\/tspan>/,
    )
    expect(svg).toMatch(
      /<tspan alignment-baseline="central" x="10" dy="1em">Phase<\/tspan>/,
    )
    expect(svg).toContain('class="grid"')
    expect(svg).not.toContain('class="today"')
    expect(svg).toContain('milestoneText')
    expect(svg).toContain('vertText')
    expect(svg).toContain('doneCritText0')
    expect(svg).toContain('critText0')
    expect(svg).toContain('activeText0')
  })

  it('draws a top axis and the today line with custom CSS', () => {
    const svg = renderMermaidSVG(`gantt
dateFormat YYYY-MM-DD
topAxis
todayMarker stroke-width:5px,stroke:#0f0,evil:url(x)
A :a, 2000-01-01, 99999d`)
    expect(svg.match(/class="grid"/g)).toHaveLength(2)
    expect(svg).toContain('class="today today-custom"')
    expect(svg).toContain('.today-custom { stroke-width: 5px; stroke: #0f0; }')
    expect(svg).not.toContain('evil')
    expect(svg).toContain('dy="0em"')
    expect(
      renderMermaidSVG(
        `gantt\ndateFormat YYYY-MM-DD\ntodayMarker bogus:1\nA :a, 2000-01-01, 99999d`,
      ),
    ).toContain('class="today"/>')
  })

  it('draws outside labels, and no title or section text when there is none', () => {
    const svg = renderMermaidSVG(`gantt
dateFormat YYYY-MM-DD
todayMarker off
A very long label that cannot fit :a, 2024-01-01, 1d
B :b, 2024-01-01, 90d`)
    expect(svg).toContain('taskTextOutsideRight')
    expect(svg).not.toContain('titleText">')
    expect(svg).not.toContain('class="sectionTitle')
  })

  it('names the diagram from accTitle and honours decorative', () => {
    const svg = renderMermaidSVG(
      `gantt\naccTitle: Release plan\ndateFormat YYYY-MM-DD\nA :a, 2024-01-01, 1d`,
    )
    expect(svg).toContain('<title id=')
    expect(svg).toContain('Release plan')
    const dec = renderMermaidSVG(
      'gantt\ndateFormat YYYY-MM-DD\nA :a, 2024-01-01, 1d',
      { decorative: true },
    )
    expect(dec).toContain('aria-hidden="true"')
  })

  it('is deterministic for a given source', () => {
    const src =
      'gantt\ndateFormat YYYY-MM-DD\ntodayMarker off\nA :a, 2024-01-01, 5d'
    expect(renderMermaidSVG(src)).toBe(renderMermaidSVG(src))
  })
})

describe('gantt layout: size config', () => {
  // Figures from mermaid@12.3.0 for this source at width 1264 (checked with
  // scripts/gantt-oracle.ts's comparison; bars, stripes, ticks and the frame matched).
  const SIZED = `%%{init: {"gantt": {"barHeight": 30, "barGap": 6, "topPadding": 60, "leftPadding": 100, "rightPadding": 40, "gridLineStartPadding": 20, "fontSize": 14, "sectionFontSize": 16, "titleTopMargin": 15}}}%%
gantt
    title Sized
    dateFormat YYYY-MM-DD
    todayMarker off
    section One
        A task :a1, 2014-05-01, 30d
        Another :after a1, 20d`
  const l = lay(SIZED)

  it('reads the size keys into the frame, rows and scale', () => {
    expect(l.height).toBe(2 * 60 + 2 * 36)
    expect(l.tasks[0]).toMatchObject({ x: 100, y: 60, height: 30 })
    expect(l.tasks[1]!.y).toBe(60 + 36)
    expect(l.axes[0]!.x).toBe(100)
    expect(l.axes[0]!.rangeEnd).toBe(1264 - 100 - 40)
    expect(l.title).toMatchObject({ y: 15 })
    expect(l.fontSize).toBe(14)
    expect(l.sectionFontSize).toBe(16)
  })

  it('keeps Mermaid defaults without the keys', () => {
    const d = lay(STATUS)
    expect(d.fontSize).toBe(GANTT.fontSize)
    expect(d.tasks[0]!.height).toBe(GANTT.barHeight)
  })

  it('writes the font sizes into the SVG', () => {
    const svg = renderMermaidSVG(SIZED)
    expect(svg).toContain('font-size="14"')
    expect(svg).toContain('font-size="16"')
  })
})
