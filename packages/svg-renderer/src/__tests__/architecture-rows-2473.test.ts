import { describe, expect, it } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import type { MermaidGraph } from '@zombie-mermaid/core'
import {
  architectureToGraph,
  parseArchitecture,
} from '@zombie-mermaid/mermaid-parser'
import { layoutGraphSync } from '../index.ts'

const graphOf = (body: string): MermaidGraph =>
  architectureToGraph(
    parseArchitecture(splitStatements(`architecture-beta\n${body}`)),
  )
const lay = (body: string) => layoutGraphSync(graphOf(body))
type Laid = ReturnType<typeof lay>
const at = (g: Laid, id: string) => g.nodes.find((n) => n.id === id)!
const mid = (g: Laid, id: string, axis: 'x' | 'y') =>
  at(g, id)[axis] + at(g, id)[axis === 'x' ? 'width' : 'height'] / 2
const group = (g: Laid, id: string) => {
  const find = (list: Laid['groups']): Laid['groups'][number] | undefined => {
    for (const x of list) {
      if (x.id === id) return x
      const hit = find(x.children)
      if (hit) return hit
    }
    return undefined
  }
  return find(g.groups)!
}

// A group's stack no longer rides on the middle of the node it links to (#2473).
describe('architecture row alignment', () => {
  const nested =
    'group cloud\ngroup data in cloud\n' +
    'service client\nservice db in data\nservice replica in data\njunction fan in cloud\n' +
    'client:R --> L:fan\nfan:R --> L:db\nfan:B --> T:replica'

  it('puts the linked member on the row of the node it links to, left to right', () => {
    const g = lay(nested)
    expect(mid(g, 'db', 'y')).toBeCloseTo(mid(g, 'fan', 'y'), 0)
    expect(at(g, 'replica').y).toBeGreaterThan(at(g, 'db').y)
    const edge = g.edges.find((e) => e.source === 'fan' && e.target === 'db')!
    for (const p of edge.points) {
      expect(p.y).toBeCloseTo(mid(g, 'fan', 'y'), 0)
    }
  })

  it('keeps the shifted group around its members and inside its parent', () => {
    const g = lay(nested)
    const data = group(g, 'data')
    const cloud = group(g, 'cloud')
    for (const id of ['db', 'replica']) {
      const n = at(g, id)
      expect(n.y).toBeGreaterThanOrEqual(data.y)
      expect(n.y + n.height).toBeLessThanOrEqual(data.y + data.height)
    }
    expect(data.y).toBeGreaterThanOrEqual(cloud.y)
    expect(data.y + data.height).toBeLessThanOrEqual(cloud.y + cloud.height)
    expect(cloud.y + cloud.height).toBeLessThanOrEqual(g.height)
  })

  it('aligns a group in a top-to-bottom graph along x', () => {
    const g = lay(
      'group cloud\ngroup data in cloud\n' +
        'service top\nservice db in data\nservice replica in data\njunction fan in cloud\n' +
        'top:B --> T:fan\nfan:B --> T:db\nfan:R --> L:replica',
    )
    expect(mid(g, 'db', 'x')).toBeCloseTo(mid(g, 'fan', 'x'), 0)
  })

  it('moves the group up when its member sits below the node it links to', () => {
    const g = lay(
      'group cloud\ngroup data in cloud\n' +
        'service client\nservice top in data\nservice db in data\njunction fan in cloud\n' +
        'client:R --> L:fan\nfan:R --> L:db\ntop:B --> T:db',
    )
    expect(mid(g, 'db', 'y')).toBeCloseTo(mid(g, 'fan', 'y'), 0)
    expect(at(g, 'top').y).toBeLessThan(at(g, 'db').y)
  })

  it('leaves an already level group alone', () => {
    const body =
      'group g\nservice a\nservice b in g\nservice c in g\na:R -- L:b\nb:B -- T:c'
    const g = lay(body)
    expect(mid(g, 'b', 'y')).toBeCloseTo(mid(g, 'a', 'y'), 0)
  })

  it('does not shift a graph without grid rows', () => {
    const graph = graphOf(nested)
    const before = layoutGraphSync(graph)
    for (const n of graph.nodes.values()) delete n.gridOrder
    const after = layoutGraphSync(graph)
    // Without rows the group stays centred on the junction, as ELK placed it.
    expect(mid(after, 'db', 'y')).not.toBeCloseTo(mid(after, 'fan', 'y'), 0)
    expect(mid(before, 'db', 'y')).toBeCloseTo(mid(before, 'fan', 'y'), 0)
  })

  it('stacks a member under the junction with a tighter margin when a neighbour is just short (#2557)', () => {
    const g = lay(
      'group cloud(cloud)[Cloud]\ngroup api(server)[API] in cloud\ngroup data(database)[Data] in cloud\n' +
        'service gw(internet)[Gateway] in api\nservice app(server)[App] in api\n' +
        'service db(database)[DB] in data\nservice replica(disk)[Replica] in data\n' +
        'junction fan in cloud\nservice client(internet)[Client]\n' +
        'client:R --> L:gw\ngw:R -- L:app\napp:R -- L:fan\nfan:R --> L:db\nfan:B --> T:replica',
    )
    expect(mid(g, 'replica', 'x')).toBeCloseTo(mid(g, 'fan', 'x'), 0)
    const api = group(g, 'api')
    expect(group(g, 'data').x).toBeGreaterThanOrEqual(api.x + api.width)
  })

  it('does not run a group into a neighbour on the way to its row', () => {
    // `above` fills the cell the shift would take; the group stays put.
    const g = lay(
      'group cloud\ngroup data in cloud\n' +
        'service client\nservice db in data\nservice replica in data\njunction fan in cloud\n' +
        'service above in cloud\n' +
        'client:R --> L:fan\nfan:R --> L:db\nfan:B --> T:replica\nreplica:R -- L:above',
    )
    const boxes = g.nodes.filter((n) => n.id !== 'client')
    for (const a of boxes) {
      for (const b of boxes) {
        if (a === b) continue
        const apart =
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y
        expect(apart).toBe(true)
      }
    }
  })
})

// `fan:B --> T:replica` puts `replica` under `fan`, and a service label stays
// inside its group (#2473).
describe('architecture sides and labels', () => {
  const icons =
    'group cloud(cloud)[Cloud]\ngroup data(database)[Data Tier] in cloud\n' +
    'service client(internet)[Client]\nservice db(database)[Primary DB] in data\n' +
    'service replica(disk)[Replica] in data\njunction fan in cloud\n' +
    'client:R --> L:fan\nfan:R --> L:db\nfan:B --> T:replica'

  it('centres the grouped end under the junction and joins them straight down', () => {
    const g = lay(icons)
    expect(mid(g, 'replica', 'x')).toBeCloseTo(mid(g, 'fan', 'x'), 0)
    expect(at(g, 'replica').y).toBeGreaterThan(at(g, 'fan').y)
    const edge = g.edges.find((e) => e.target === 'replica')!
    expect(edge.points).toHaveLength(2)
    expect(edge.points[0]!.x).toBeCloseTo(edge.points[1]!.x, 0)
    expect(edge.points[1]!.y).toBeCloseTo(at(g, 'replica').y, 0)
  })

  it('grows the group to take the moved member and keeps it inside its parent', () => {
    const g = lay(icons)
    const data = group(g, 'data')
    const cloud = group(g, 'cloud')
    const r = at(g, 'replica')
    expect(data.x).toBeLessThanOrEqual(r.x - 16)
    expect(data.x + data.width).toBeGreaterThanOrEqual(r.x + r.width + 16)
    expect(cloud.x).toBeLessThanOrEqual(data.x)
    expect(cloud.x + cloud.width).toBeGreaterThanOrEqual(data.x + data.width)
  })

  it('leaves room under an icon tile for its label inside the group', () => {
    const g = lay(icons)
    const data = group(g, 'data')
    const r = at(g, 'replica')
    expect(data.y + data.height - (r.y + r.height)).toBeGreaterThanOrEqual(26)
  })
})
