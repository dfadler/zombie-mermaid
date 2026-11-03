/**
 * #2549: mermaid 12.2.0 (and 12.3.0) put the start cardinality on the
 * right-hand side of the edge's direction of travel and the end cardinality on
 * the left-hand side. For a top-down edge that is "1" left of the line and "9"
 * right of it.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const pos = (svg: string, text: string): { x: number; y: number } => {
  const m = new RegExp(
    `<text x="([\\d.-]+)" y="([\\d.-]+)"[^>]*>${text}</text>`,
  ).exec(svg)!
  return { x: Number(m[1]), y: Number(m[2]) }
}

describe('class cardinality label sides (#2549)', () => {
  const render = (dir: string) =>
    renderMermaidSVG(`classDiagram\n  direction ${dir}\n  A "1" --> "9" B`)

  it('TB: start label left of the line, end label right of it', () => {
    const svg = render('TB')
    expect(pos(svg, '1').x).toBeLessThan(pos(svg, '9').x)
  })

  it('BT: the sides swap', () => {
    const svg = render('BT')
    expect(pos(svg, '1').x).toBeGreaterThan(pos(svg, '9').x)
  })

  it('LR: start label below the line, end label above it', () => {
    const svg = render('LR')
    expect(pos(svg, '1').y).toBeGreaterThan(pos(svg, '9').y)
  })
})
