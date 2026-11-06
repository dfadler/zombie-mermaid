/**
 * #2549: mermaid 12.2.0 (and 12.3.0) put the start cardinality on the
 * right-hand side of the edge's direction of travel and the end cardinality on
 * the left-hand side. For a top-down edge that is "1" left of the line and "9"
 * right of it. The label is anchored at its near edge, so a long one such as
 * "many" still starts (right) or ends (left) clear of the line.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

interface Label {
  x: number
  y: number
  anchor: string
}

const pos = (svg: string, text: string): Label => {
  for (const m of svg.matchAll(
    /<text x="([\d.-]+)" y="([\d.-]+)"[^>]*? text-anchor="(\w+)"[^>]*>([^<]*)<\/text>/g,
  )) {
    if (m[4] === text) {
      return { x: Number(m[1]), y: Number(m[2]), anchor: m[3] ?? 'none' }
    }
  }
  throw new Error(`no <text> with content ${text}`)
}

describe('class cardinality label sides (#2549)', () => {
  const render = (dir: string, from = '1', to = '9') =>
    renderMermaidSVG(
      `classDiagram\n  direction ${dir}\n  A "${from}" --> "${to}" B`,
    )

  it('TB: start label left of the line, end label right of it', () => {
    const svg = render('TB')
    expect(pos(svg, '1').x).toBeLessThan(pos(svg, '9').x)
  })

  it('a long label stays clear of the line on either side', () => {
    const svg = render('TB', 'many', 'lots')
    const left = pos(svg, 'many')
    const right = pos(svg, 'lots')
    // Anchored at the near edge: text grows away from the line.
    expect(left.anchor).toBe('end')
    expect(right.anchor).toBe('start')
    // Both anchors sit a gap either side of the (vertical) line.
    expect(right.x - left.x).toBeGreaterThan(0)
  })

  it('BT: the sides swap', () => {
    const svg = render('BT')
    expect(pos(svg, '1').x).toBeGreaterThan(pos(svg, '9').x)
  })

  it('LR: start label below the line, end label above it', () => {
    const svg = render('LR')
    expect(pos(svg, '1').y).toBeGreaterThan(pos(svg, '9').y)
    expect(pos(svg, '1').anchor).toBe('middle')
  })

  // #2721: mermaid 12.3.0 sets a label 6 further out, along and across the
  // edge, when its end carries a marker, so it clears the marker.
  it.each([
    ['start', 'A "1" <|-- B', 'A "1" --> B'],
    ['end', 'A --> "1" B', 'A <-- "1" B'],
  ])('%s marker pushes the label 6 further out', (_n, marked, plain) => {
    const a = pos(renderMermaidSVG(`classDiagram\n  ${marked}`), '1')
    const b = pos(renderMermaidSVG(`classDiagram\n  ${plain}`), '1')
    expect(Math.abs(a.x - b.x)).toBeCloseTo(6, 1)
    expect(Math.abs(a.y - b.y)).toBeCloseTo(6, 1)
  })
})
