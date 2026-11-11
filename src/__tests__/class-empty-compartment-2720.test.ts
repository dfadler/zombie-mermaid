/**
 * Empty class compartments (#2720): mermaid 12.3.0 draws them 24 px next to a
 * compartment with members and 18 px in a member-less class, against a 48 px
 * header. The ASCII box already draws the empty compartment as a full row, so only
 * the SVG changes.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

/** Y of each horizontal divider inside the (single) class box. */
const dividers = (src: string): number[] =>
  [...renderMermaidSVG(src).matchAll(/<line x1="[\d.]+" y1="([\d.]+)"/g)].map(
    (m) => Number(m[1]),
  )
const gaps = (ys: number[]): number[] => ys.slice(1).map((y, i) => y - ys[i]!)

describe('empty class compartment height', () => {
  it('member-less class: both compartments 18', () => {
    expect(gaps(dividers('classDiagram\nclass A'))).toEqual([18])
  })
  it('methods only: empty attributes compartment is 24', () => {
    expect(gaps(dividers('classDiagram\nclass A {\n+foo()\n}'))[0]).toBe(24)
  })
  it('attributes only: box is header 48 + 48 + empty 24 tall', () => {
    const svg = renderMermaidSVG('classDiagram\nclass A {\n+int x\n}')
    expect(svg).toMatch(/<rect[^>]*height="120"/)
  })
})
