/**
 * Journey layout and SVG. Geometry expectations are measured from
 * mermaid@12.3.0 rendering the same sources (viewBox, section bars, faces).
 */
import { describe, it, expect } from 'vitest'
import { parseJourney } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG } from '../index.ts'
import {
  layoutJourney,
  wrapLegendLabel,
  wrapTaskLabel,
} from '../journey/layout.ts'

const layout = (src: string) => layoutJourney(parseJourney(src))
const BASIC = `journey
    title My working day
    section Go to work
      Make tea: 5: Me
      Go upstairs: 3: Me
      Do work: 1: Me, Cat
    section Go home
      Go downstairs: 5: Me
      Sit down: 5: Me`

describe('layoutJourney', () => {
  it('matches mermaid@12.3.0 for the basic sample', () => {
    const l = layout(BASIC)
    // viewBox "0 -25 1300 540"; the -25 origin is shifted into the content.
    expect(l.width).toBe(1300)
    expect(l.height).toBe(540)
    expect(l.axis).toMatchObject({ x1: 150, x2: 1146, y1: 225 })
    expect(l.tasks.map((t) => t.x)).toEqual([150, 350, 550, 750, 950])
    expect(l.sections.map((s) => [s.x, s.width])).toEqual([
      [150, 550],
      [750, 350],
    ])
    expect(l.tasks.map((t) => t.faceY - 25)).toEqual([300, 360, 420, 300, 300])
    expect(l.legend.map((r) => r.lines[0]!.text)).toEqual(['Cat', 'Me'])
  })

  it('draws a bare journey as just the axis (viewBox 400x90 with a title)', () => {
    const l = layout('journey\ntitle Empty')
    expect([l.width, l.height]).toEqual([400, 90])
    expect(l.tasks).toEqual([])
  })

  it('gives tasks before any section no bar, and cycles 7 section colours', () => {
    const l = layout('journey\nA: 1\nsection S\nB: 2')
    expect(l.sections).toHaveLength(1)
    expect(l.tasks.map((t) => t.num)).toEqual([0, 0])
    const many = layout(
      'journey\n' +
        Array.from({ length: 9 }, (_, i) => `section S${i}\nT${i}: 3`).join(
          '\n',
        ),
    )
    expect(many.sections.map((s) => s.num)).toEqual([0, 1, 2, 3, 4, 5, 6, 0, 1])
  })

  it('wraps legend labels at 360px and labels at 150px', () => {
    expect(
      wrapLegendLabel(
        'A Very Long Actor Name That Wraps Around The Legend Because It Is Longer Than Others',
      ),
    ).toEqual([
      'A Very Long Actor Name That Wraps Around The',
      'Legend Because It Is Longer Than Others',
    ])
    expect(wrapLegendLabel('x'.repeat(80)).every((l) => l.length < 80)).toBe(
      true,
    )
    expect(wrapTaskLabel('Make tea')).toEqual(['Make tea'])
    expect(wrapTaskLabel('one<br>two')).toEqual(['one', 'two'])
    expect(
      wrapTaskLabel('A task with a very long description that wraps'),
    ).toHaveLength(3)
  })

  it('leaves room for a wide legend label', () => {
    const l = layout(
      'journey\nA: 3: A Very Long Actor Name That Wraps Around The Legend',
    )
    expect(l.tasks[0]!.x).toBeGreaterThan(150 + 75)
  })
})

describe('renderMermaidSVG – journey', () => {
  const svg = renderMermaidSVG(BASIC)

  it('draws a smile, a straight mouth and a sad mouth', () => {
    expect(svg.match(/class="mouth"/g)).toHaveLength(4)
    expect(svg.match(/class="mouth-line"/g)).toHaveLength(1)
    expect(svg).toContain('class="face"')
  })

  it('draws one dot per actor on a task and a titled dot tooltip', () => {
    expect(svg).toContain('<title>Cat</title>')
    expect(svg.match(/<title>Me<\/title>/g)).toHaveLength(5)
  })

  it('draws the title, axis arrowhead and one dashed line per task', () => {
    expect(svg).toContain('My working day')
    expect(svg).toMatch(/marker-end="url\(#[\w-]*journey-arrowhead\)"/)
    expect(svg.match(/stroke-dasharray="4 2"/g)).toHaveLength(5)
  })

  it('puts the smile boundary between 3 and 4 and the sad one between 2 and 3', () => {
    const mouth = (n: number) =>
      renderMermaidSVG(`journey\nA: ${n}`).match(
        /class="(mouth|mouth-line)" (?:d="(M-?7\.5)|x1)/,
      )
    expect(mouth(4)![2]).toBe('M7.5')
    expect(mouth(3)![1]).toBe('mouth-line')
    expect(mouth(2)![2]).toBe('M-7.5')
  })

  it('escapes text', () => {
    expect(renderMermaidSVG('journey\n<b>&: 3: <i>')).toContain(
      '&lt;b&gt;&amp;',
    )
  })

  it('treats a NaN score as a straight mouth at a finite position', () => {
    const out = renderMermaidSVG('journey\nA: x: Me')
    expect(out).not.toContain('NaN')
    expect(out).toContain('class="mouth-line"')
  })
})
