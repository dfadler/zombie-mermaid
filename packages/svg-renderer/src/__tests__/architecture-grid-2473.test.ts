import { describe, expect, it } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import {
  architectureToGraph,
  parseArchitecture,
} from '@zombie-mermaid/mermaid-parser'
import { layoutGraphSync } from '../index.ts'
import { convertToElkFormat } from '../layout-engine.ts'

const lay = (body: string) =>
  layoutGraphSync(
    architectureToGraph(
      parseArchitecture(splitStatements(`architecture-beta\n${body}`)),
    ),
  )
const at = (g: ReturnType<typeof lay>, id: string) =>
  g.nodes.find((n) => n.id === id)!
const svc = (ids: string, tail = '') =>
  ids
    .split(' ')
    .map((i) => `service ${i}${tail}\n`)
    .join('')

// Side-linked and stacked services sit where their ports say (#2473).
describe('architecture port grid in the SVG layout', () => {
  it('stacks a T/B-linked service straight under its partner, in a left-to-right graph', () => {
    const g = lay(
      svc('db server cloud web disk') +
        'db:R -- L:server\nserver:R -- L:cloud\nserver:B -- T:disk\ncloud:T -- B:web',
    )
    expect(at(g, 'disk').x).toBeCloseTo(at(g, 'server').x, 0)
    expect(at(g, 'disk').y).toBeGreaterThan(at(g, 'server').y)
    expect(at(g, 'web').x).toBeCloseTo(at(g, 'cloud').x, 0)
    expect(at(g, 'web').y).toBeLessThan(at(g, 'cloud').y)
    // The stacked edge is a short vertical run from one box to the other.
    const edge = g.edges.find(
      (e) => e.source === 'server' && e.target === 'disk',
    )!
    expect(edge.points).toHaveLength(2)
    expect(edge.points[0]!.x).toBe(edge.points[1]!.x)
    expect(edge.points[0]!.y).toBe(at(g, 'server').y + at(g, 'server').height)
    expect(edge.points[1]!.y).toBe(at(g, 'disk').y)
  })

  it('draws the edge upwards when the target sits above its source', () => {
    const g = lay(svc('a b c') + 'a:R -- L:b\nb:T -- B:c')
    const edge = g.edges.find((e) => e.source === 'b' && e.target === 'c')!
    expect(edge.points[0]!.y).toBeGreaterThan(edge.points[1]!.y)
  })

  it('puts left-right neighbours side by side in a top-to-bottom graph', () => {
    const g = lay(svc('a b c d') + 'a:B -- T:b\nb:B -- T:c\nb:R -- L:d')
    expect(at(g, 'd').y).toBeCloseTo(at(g, 'b').y, 0)
    expect(at(g, 'd').x).toBeGreaterThan(at(g, 'b').x)
    const edge = g.edges.find((e) => e.source === 'b' && e.target === 'd')!
    expect(edge.points[0]!.y).toBe(edge.points[1]!.y)
  })

  it('leaves grouped services to the layered layout, inside their group', () => {
    const g = lay(
      'group g\n' + svc('a b c', ' in g') + 'a:R -- L:b\nb:B -- T:c',
    )
    const box = g.groups[0]!
    for (const id of ['a', 'b', 'c']) {
      const n = at(g, id)
      expect(n.x).toBeGreaterThanOrEqual(box.x)
      expect(n.x + n.width).toBeLessThanOrEqual(box.x + box.width)
      expect(n.y).toBeGreaterThanOrEqual(box.y)
      expect(n.y + n.height).toBeLessThanOrEqual(box.y + box.height)
    }
    expect(g.edges).toHaveLength(2)
  })

  it('lays out ports that form a cycle without failing', () => {
    const g = lay(svc('a b c') + 'a:R -- L:b\nb:R -- L:c\nc:R -- L:a')
    expect(g.nodes).toHaveLength(3)
  })

  it('falls back to column 0 and no partition when grid fields are missing', () => {
    const graph = architectureToGraph(
      parseArchitecture(
        splitStatements(
          'architecture-beta\ngroup g\n' +
            svc('a b', '') +
            svc('c d', ' in g') +
            'a:R -- L:b\nc:R -- L:d',
        ),
      ),
    )
    // Hand-built graphs may carry a layer without an order, or no grid at all.
    for (const id of ['b', 'c', 'd']) {
      const n = graph.nodes.get(id)!
      if (id === 'b') delete n.gridOrder
      else {
        delete n.gridLayer
        delete n.gridOrder
      }
    }
    const json = JSON.stringify(convertToElkFormat(graph))
    expect(json).not.toMatch(/NaN|Infinity|undefined/)
    const g = layoutGraphSync(graph)
    expect(g.nodes).toHaveLength(4)
    expect(at(g, 'b').x).toBeGreaterThan(at(g, 'a').x)
  })
})
