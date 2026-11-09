/**
 * Radar SVG: Mermaid's fixed geometry, the structure and class names, and the
 * theme mapping. Agreement with mermaid.js itself is __tests__/radar-agreement.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { parseRadar } from '@zombie-mermaid/mermaid-parser'
import { layoutRadar, renderMermaidSVG } from '../index.ts'

const SRC = `radar-beta
  title Grades
  axis m["Math"], s["Science"], e["English"]
  curve a["Alice"]{50, 100, 0}
  curve b["Bob"]{100, 50, 50}
  max 100`

describe('layoutRadar', () => {
  const layout = layoutRadar(parseRadar(SRC))

  it('uses the 700 x 700 frame with the centre at 350, 350', () => {
    expect([layout.width, layout.height]).toEqual([700, 700])
    expect([layout.centerX, layout.centerY]).toEqual([350, 350])
  })

  it('draws five circle rings out to radius 300', () => {
    expect(layout.rings.map((r) => (r.kind === 'circle' ? r.r : -1))).toEqual([
      60, 120, 180, 240, 300,
    ])
  })

  it('points the first axis up and goes clockwise', () => {
    expect(layout.axes.map((a) => [a.x2, a.y2])).toEqual([
      [0, -300],
      [259.81, 150],
      [-259.81, 150],
    ])
    expect(layout.axes.map((a) => [a.anchor, a.baseline])).toEqual([
      ['middle', 'auto'],
      ['start', 'hanging'],
      ['end', 'hanging'],
    ])
  })

  it('maps a value to its share of the radius', () => {
    const [alice] = layout.curves
    expect(alice!.kind).toBe('path')
    // 50 of 100 is half way up the first axis: (0, -150).
    expect(alice!.d).toMatch(/^M0,-150 C/)
  })

  it('stacks the legend in the top right', () => {
    expect(layout.legend).toEqual([
      { index: 0, label: 'Alice', x: 262.5, y: -262.5 },
      { index: 1, label: 'Bob', x: 262.5, y: -242.5 },
    ])
  })

  it('uses polygons for a polygon graticule', () => {
    const l = layoutRadar(
      parseRadar(
        'radar-beta\naxis a,b,c\ncurve x{1,2,3}\ngraticule polygon\nticks 2',
      ),
    )
    expect(l.rings).toHaveLength(2)
    expect(l.rings[0]!.kind).toBe('polygon')
    expect(l.curves[0]!.kind).toBe('polygon')
    expect(l.curves[0]!.points).toHaveLength(3)
  })

  it('clips values to min and max', () => {
    const l = layoutRadar(
      parseRadar(
        'radar-beta\naxis a,b\ncurve x{0,99}\nmin 10\nmax 20\ngraticule polygon',
      ),
    )
    // 0 is below min: the centre; 99 is above max: the outer ring, on the second axis (straight down).
    expect(l.curves[0]!.points).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 300 },
    ])
  })

  it('leaves a curve with the wrong number of values undrawn but in the legend', () => {
    const l = layoutRadar(
      parseRadar('radar-beta\naxis a,b,c\ncurve x{1,2}\ncurve y{1,2,3}'),
    )
    expect(l.curves.map((c) => c.index)).toEqual([1])
    expect(l.legend.map((i) => i.label)).toEqual(['x', 'y'])
  })

  it('has no legend with showLegend false', () => {
    expect(
      layoutRadar(
        parseRadar('radar-beta\naxis a\ncurve x{1}\nshowLegend false'),
      ).legend,
    ).toEqual([])
  })
})

describe('renderMermaidSVG – radar', () => {
  const svg = renderMermaidSVG(SRC)

  it('writes Mermaid’s elements and class names', () => {
    expect(svg.match(/class="radarGraticule"/g)).toHaveLength(5)
    expect(svg.match(/class="radarAxisLine"/g)).toHaveLength(3)
    expect(svg).toContain('class="radarAxisLabel">Math</text>')
    expect(svg).toContain('class="radarCurve-0"')
    expect(svg).toContain('class="radarCurve-1"')
    expect(svg).toContain('class="radarLegendBox-1"')
    expect(svg).toContain('class="radarLegendText">Bob</text>')
    expect(svg).toContain('class="radarTitle" x="0" y="-350">Grades</text>')
    expect(svg).toContain('viewBox="0 0 700 700"')
  })

  it('colours the curves from the theme accent', () => {
    expect(svg).toMatch(/--radar-color-0: var\(--accent/)
    expect(svg).toMatch(/\.radarCurve-1 \{ fill: var\(--radar-color-1\)/)
  })

  it('escapes labels and the title', () => {
    const out = renderMermaidSVG(
      'radar-beta\ntitle A & B\naxis a["<x>"]\ncurve c["1 < 2"]{1}',
    )
    expect(out).toContain('A &amp; B')
    expect(out).toContain('&lt;x&gt;')
    expect(out).toContain('1 &lt; 2')
    expect(out).not.toContain('<x>')
  })

  it('still writes the empty title element, as Mermaid does', () => {
    expect(renderMermaidSVG('radar-beta\naxis a')).toContain(
      'class="radarTitle" x="0" y="-350"></text>',
    )
  })

  it('renders an empty radar', () => {
    expect(renderMermaidSVG('radar-beta')).toContain('<svg')
  })

  it('throws a parse error for bad input', () => {
    expect(() => renderMermaidSVG('radar-beta\naxis')).toThrow(
      /expected an axis name/,
    )
  })
})
