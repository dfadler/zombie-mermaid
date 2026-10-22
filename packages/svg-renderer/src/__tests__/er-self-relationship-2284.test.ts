/**
 * #2284: a self-relationship drew its label over the entity and hid the
 * markers. Mermaid 12.1.0 and 12.2.0 draw a loop left of the box with the
 * label beside it, clear of the box.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const SRC = 'erDiagram\n  EMPLOYEE ||--o{ EMPLOYEE : manages\n'

const nums = (s: string) => s.split(/[ ,]/).map(Number)

describe('ER self-relationship (#2284)', () => {
  const svg = renderMermaidSVG(SRC)
  const loop = nums(/<polyline[^>]* points="([^"]+)"/.exec(svg)![1]!)
  const box = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)"/.exec(svg)!
  const boxX = Number(box[1])
  // The label pill is the rect with rx="2".
  const pill =
    /<rect x="([\d.-]+)" y="[\d.-]+" width="([\d.]+)" height="[\d.]+" rx="2"/.exec(
      svg,
    )!

  it('draws a loop that leaves and re-enters the box on its left side', () => {
    const [x0, , x1, , x2, , x3] = loop
    expect([x0, x3]).toEqual([boxX, boxX])
    expect(x1).toBeLessThan(boxX - 10)
    expect(x2).toBe(x1)
  })

  it('keeps the label left of the loop, clear of the box, inside the canvas', () => {
    const left = Number(pill[1])
    expect(left).toBeGreaterThanOrEqual(0)
    expect(left + Number(pill[2])).toBeLessThanOrEqual(loop[2]!)
  })

  it('draws both markers', () => {
    expect((svg.match(/<line /g) ?? []).length).toBe(6)
    expect((svg.match(/<circle /g) ?? []).length).toBe(1)
  })

  it('nests a second loop on the same entity beyond the first', () => {
    const two = renderMermaidSVG(`${SRC}  EMPLOYEE ||--|| EMPLOYEE : b\n`)
    const xs = [...two.matchAll(/<polyline[^>]* points="([^"]+)"/g)].map(
      (m) => nums(m[1]!)[2]!,
    )
    expect(xs).toHaveLength(2)
    expect(xs[1]).toBeLessThan(xs[0]!)
    expect(two).toContain('>b</text>')
  })
})
