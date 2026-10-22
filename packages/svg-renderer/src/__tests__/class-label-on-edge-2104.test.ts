/**
 * Class relationship labels sit ON the edge over a background plate (#2104).
 * mermaid.js (12.1.0 and 12.2.0 agree) centres the label box on the edge's
 * first segment and fills it so the line does not run through the text; ELK
 * places the box beside the edge, so the renderer snaps it onto the route.
 */
import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import { parseClassDiagram } from '@zombie-mermaid/mermaid-parser'
import { layoutClassDiagramSync } from '../class/layout.ts'
import { renderMermaidSVG, renderClassSvg } from '../index.ts'

const SRC = `classDiagram
  Teacher --> Course : teaches
  Student --> Course : enrolled in`

const plates = (svg: string) =>
  [
    ...svg.matchAll(
      /<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)" class="class-relationship-label-bg" fill="var\(--bg\)" \/>/g,
    ),
  ].map((m) => m.slice(1).map(Number) as [number, number, number, number])

describe('class relationship label is centred on its edge', () => {
  it('draws one plate per label, centred on the edge x, on the edge y-range', () => {
    const rels = layoutClassDiagramSync(
      parseClassDiagram(splitStatements(SRC)),
    ).relationships
    const found = plates(renderMermaidSVG(SRC))
    expect(found).toHaveLength(2)
    for (const [i, [x, y, w, h]] of found.entries()) {
      const pts = rels[i]!.points
      // First segment is vertical: plate centre x equals the edge x
      expect(x + w / 2).toBeCloseTo(pts[0]!.x, 1)
      const cy = y + h / 2
      expect(cy).toBeGreaterThan(pts[0]!.y)
      expect(cy).toBeLessThan(pts[1]!.y)
    }
  })

  it('label text is centred on the same point as its plate', () => {
    const svg = renderMermaidSVG(SRC)
    const [x, , w] = plates(svg)[0]!
    const tx = Number(/<text x="([\d.]+)"[^>]*>teaches</.exec(svg)![1])
    expect(tx).toBeCloseTo(x + w / 2, 1)
  })
})

describe('label snap on hand-built routes', () => {
  const centre = (
    points: Array<{ x: number; y: number }>,
    labelPosition?: { x: number; y: number },
  ) => {
    const d = layoutClassDiagramSync(parseClassDiagram(splitStatements(SRC)))
    const rel = d.relationships[0]!
    const { labelPosition: _drop, ...rest } = rel
    const rels = [
      { ...rest, points, ...(labelPosition ? { labelPosition } : {}) },
    ]
    const svg = renderClassSvg(
      { ...d, relationships: rels },
      { bg: '#ffffff', fg: '#000000' },
    )
    const [x, y, w, h] = plates(svg)[0]!
    return [x + w / 2, y + h / 2].map((n) => Math.round(n))
  }

  it('snaps past a zero-length segment onto the real one', () => {
    const pts = [
      { x: 10, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 50 },
    ]
    expect(centre(pts, { x: 30, y: 30 })).toEqual([10, 30])
  })

  it('falls back to the route midpoint without a layout position', () => {
    const pts = [
      { x: 10, y: 10 },
      { x: 10, y: 50 },
    ]
    expect(centre(pts)).toEqual([10, 50])
  })
})
