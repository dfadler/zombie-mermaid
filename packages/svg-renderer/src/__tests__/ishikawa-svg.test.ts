import { describe, expect, it } from 'vitest'
import { renderMermaidSVG } from '../index.ts'
import {
  ISHIKAWA,
  layoutIshikawa,
  wrapIshikawaText,
} from '../ishikawa/layout.ts'
import { parseIshikawa } from '@zombie-mermaid/mermaid-parser'

const layout = (src: string) => layoutIshikawa(parseIshikawa(src))!

describe('ishikawa SVG', () => {
  it('lays out nothing for a header with no lines, and still renders an SVG', () => {
    expect(layoutIshikawa(parseIshikawa('ishikawa\n'))).toBeUndefined()
    expect(renderMermaidSVG('ishikawa\n')).toMatch(/^<svg[^>]*>[\s\S]*<\/svg>$/)
  })

  it('draws a lone effect as a head on a zero-length spine', () => {
    const l = layout('ishikawa\n  Effect')
    expect(l.items).toEqual([])
    expect(l.spine.x1).toBe(l.spine.x2)
    expect(l.head.lines).toEqual(['Effect'])
  })

  it('slants each bone 82° away from the spine, upper first and lower second', () => {
    const l = layout('ishikawa\n  E\n    A\n      a\n    B\n      b')
    const bones = l.items.flatMap((i) =>
      i.kind === 'line' && i.line.cls === 'ishikawa-branch' ? [i.line] : [],
    )
    expect(bones).toHaveLength(2)
    const [up, down] = bones as [(typeof bones)[0], (typeof bones)[0]]
    for (const b of [up, down]) {
      const angle = Math.atan2(Math.abs(b.y2 - b.y1), b.x1 - b.x2)
      expect(angle).toBeCloseTo(ISHIKAWA.angle, 5)
    }
    expect(up.y2).toBeLessThan(l.spine.y1)
    expect(down.y2).toBeGreaterThan(l.spine.y1)
  })

  it('shares the 500px bone pool by descendants, so a busy side gets the longer bones', () => {
    const l = layout(
      'ishikawa\n  E\n    A\n      a1\n      a2\n      a3\n    B\n      b1',
    )
    const len = (i: number) => {
      const b = l.items.filter(
        (x) => x.kind === 'line' && x.line.cls === 'ishikawa-branch',
      )[i]
      if (b?.kind !== 'line') throw new Error('no bone')
      return Math.hypot(b.line.x2 - b.line.x1, b.line.y2 - b.line.y1)
    }
    expect(len(0)).toBeCloseTo(375, 0)
    expect(len(1)).toBeCloseTo(125, 0)
  })

  it('wraps a cause at 15 characters and the effect in the head', () => {
    expect(wrapIshikawaText('short', 15)).toBe('short')
    expect(wrapIshikawaText('one two three four', 8)).toBe(
      'one two\nthree\nfour',
    )
    const svg = renderMermaidSVG(
      'ishikawa\n  A long effect label here\n    Cat\n      a rather long cause',
    )
    expect(svg).toContain('>a rather long</tspan>')
    expect(svg).toContain('>cause</tspan>')
    expect(layout('ishikawa\n  A long effect label here').head.lines).toEqual([
      'A long',
      'effect',
      'label here',
    ])
  })

  it('escapes label text and splits it at <br>', () => {
    const svg = renderMermaidSVG('ishikawa\n  E\n    a<br>b\n      x & y')
    expect(svg).toContain('>a</tspan>')
    expect(svg).toContain('>b</tspan>')
    expect(svg).toContain('x &amp; y')
  })

  it('uses theme variables, not fixed colours, for the bones, boxes and text', () => {
    const svg = renderMermaidSVG('ishikawa\n  E\n    A\n      a')
    expect(svg).toContain('stroke: var(--_line)')
    expect(svg).toContain('fill: var(--_node-fill)')
    expect(svg).toContain('fill: var(--_text)')
    expect(svg).toMatch(/marker-start="url\(#[\w-]*ishikawa-arrow\)"/)
  })

  it('puts every shape inside the frame', () => {
    const svg = renderMermaidSVG(
      'ishikawa\n  E\n    A\n      a\n        b\n    B\n      c\n    C\n      d',
    )
    const [, w, h] = /width="([\d.]+)" height="([\d.]+)"/
      .exec(svg)!
      .map(Number) as [number, number, number]
    for (const m of svg.matchAll(
      /<line [^>]*x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/g,
    )) {
      const [x1, y1, x2, y2] = m.slice(1).map(Number) as [
        number,
        number,
        number,
        number,
      ]
      for (const x of [x1, x2]) expect(x).toBeGreaterThanOrEqual(0)
      for (const x of [x1, x2]) expect(x).toBeLessThanOrEqual(w)
      for (const y of [y1, y2]) expect(y).toBeGreaterThanOrEqual(0)
      for (const y of [y1, y2]) expect(y).toBeLessThanOrEqual(h)
    }
  })
})
