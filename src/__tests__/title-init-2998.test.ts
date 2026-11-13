import { describe, it, expect } from 'vitest'
import { parseInitDirective } from '@zombie-mermaid/core'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

// Checked against mermaid@12.3.0 (#2998): every diagram title goes through
// DOMPurify, so `&` is `&amp;` and kept tags are text; `#65;` decodes to `A`.
const T = 'A & B <b>x</b> &amp; #65;'
const SHOWN = 'A &amp; B <b>x</b> &amp; A'
const sources: Record<string, string> = {
  pie: `pie title ${T}\n "a": 1`,
  gantt: `gantt\n title ${T}\n dateFormat YYYY-MM-DD\n section S\n t :2024-01-01, 2d`,
  timeline: `timeline\n title ${T}\n 2020 : a`,
  quadrant: `quadrantChart\n title ${T}\n x-axis L --> R\n y-axis B --> T\n a: [0.3, 0.6]`,
  xychart: `xychart-beta\n title "${T}"\n x-axis [a, b]\n bar [1, 2]`,
  radar: `radar-beta\n title ${T}\n axis a, b, c\n curve x{1,2,3}`,
}
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

describe('diagram titles are sanitized like mermaid 12.3.0 (#2998)', () => {
  it.each(Object.keys(sources))('%s svg', (k) => {
    expect(renderMermaidSVG(sources[k]!)).toContain(esc(SHOWN))
  })
  it.each(Object.keys(sources))('%s ascii', (k) => {
    expect(renderMermaidASCII(sources[k]!)).toContain(SHOWN)
  })
})

describe('init values coerce like mermaid 12.3.0 (#2998)', () => {
  const init = (k: string, o: object) =>
    parseInitDirective(`%%{init: ${JSON.stringify({ [k]: o })}}%%`)
  it('numeric strings work as numbers', () => {
    expect(init('timeline', { padding: '80' })?.timeline).toEqual({
      padding: 80,
    })
    expect(init('kanban', { sectionWidth: '300' })?.kanban).toEqual({
      sectionWidth: 300,
    })
    expect(init('sankey', { width: '900' })?.sankey).toEqual({ width: 900 })
    expect(init('class', { padding: '30' })?.classLayout).toEqual({
      padding: 30,
    })
    expect(init('er', { minEntityWidth: '200' })?.erLayout).toEqual({
      minEntityWidth: 200,
    })
    expect(init('quadrantChart', { chartWidth: '700' })?.quadrant).toEqual({
      chartWidth: 700,
    })
    expect(init('xyChart', { height: '300' })?.xyChart).toEqual({ height: 300 })
    expect(
      init('architecture', { iconSize: '60' })?.architectureLayout,
    ).toEqual({ iconSize: 60 })
  })
  it('timeline leftMargin string stays dropped (mermaid concatenates it)', () => {
    expect(init('timeline', { leftMargin: '200' })?.timeline).toEqual({})
  })
  it('timeline disableMulticolor is by truthiness', () => {
    expect(init('timeline', { disableMulticolor: 'false' })?.timeline).toEqual({
      disableMulticolor: true,
    })
    expect(init('timeline', { disableMulticolor: 0 })?.timeline).toEqual({
      disableMulticolor: false,
    })
  })
})
