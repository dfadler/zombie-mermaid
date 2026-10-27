/**
 * #1796: the screenshot tolerance (threshold 0.4, 0.2% of pixels) cannot see a
 * small layout shift, so each fix below is pinned on laid-out coordinates.
 */
import { describe, it, expect } from 'vitest'
import { parseClassDiagram } from '@zombie-mermaid/mermaid-parser'
import {
  layoutClassDiagramSync,
  layoutFlowchartSync,
} from '@zombie-mermaid/svg-renderer'
import { splitStatements } from '@zombie-mermaid/core'
import type { MermaidGraph } from '@zombie-mermaid/core'
import { parseMermaid } from '../index.ts'
import { samples } from '../../samples/samples-data.ts'

describe('general-22 System Architecture trunk (#1749, #1782)', () => {
  it('keeps every fan-out trunk 8px clear of the Client Layer border', () => {
    const src = samples.find((s) => s.title === 'System Architecture')!.source
    const p = layoutFlowchartSync(parseMermaid(src) as MermaidGraph)
    const clients = p.groups.find((g) => g.id === 'clients')!
    const side = clients.x + clients.width
    const trunks = p.edges
      .filter((e) => e.source === 'B')
      .flatMap((e) => e.points.slice(1, -1).map((pt) => pt.x))
    expect(trunks.length).toBeGreaterThan(0)
    for (const x of trunks) expect(Math.abs(x - side)).toBeGreaterThanOrEqual(8)
  })
})

describe('class diagram parent centred over its children (#2020)', () => {
  it('puts the parent at the midpoint of its outer children', () => {
    const d = parseClassDiagram(
      splitStatements(
        'classDiagram\n  Animal <|-- Dog\n  Animal <|-- Cat\n  Animal <|-- Bird',
      ),
    )
    const cs = layoutClassDiagramSync(d).classes
    const mid = (id: string) => {
      const c = cs.find((k) => k.id === id)!
      return c.x + c.width / 2
    }
    const kids = ['Dog', 'Cat', 'Bird'].map(mid)
    const centre = (Math.min(...kids) + Math.max(...kids)) / 2
    expect(Math.abs(mid('Animal') - centre)).toBeLessThanOrEqual(1)
  })
})
