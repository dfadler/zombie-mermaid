import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import {
  parseArchitecture,
  architectureToGraph,
} from '@zombie-mermaid/mermaid-parser'
import { layoutArchitectureGrid } from '../layout-engine/architecture-grid.ts'

const layout = (body: string) =>
  layoutArchitectureGrid(
    architectureToGraph(
      parseArchitecture(splitStatements(`architecture-beta\n${body}`)),
    ),
  )
const node = (g: ReturnType<typeof layout>, id: string) =>
  g.nodes.find((n) => n.id === id)!
const centre = (n: {
  x: number
  y: number
  width: number
  height: number
}) => ({
  x: n.x + n.width / 2,
  y: n.y + n.height / 2,
})

describe('architecture grid layout (#2619)', () => {
  it('puts a service one pitch below the junction a B port names', () => {
    const g = layout(
      'service a\nservice b\nservice c\njunction j\na:R -- L:j\nj:R --> L:b\nj:B --> T:c',
    )
    expect(centre(node(g, 'c')).x).toBe(centre(node(g, 'j')).x)
    expect(centre(node(g, 'c')).y - centre(node(g, 'j')).y).toBe(200)
    expect(centre(node(g, 'b')).y).toBe(centre(node(g, 'a')).y)
    // Every edge is one straight run.
    for (const e of g.edges) expect(e.points).toHaveLength(2)
  })

  it('widens the gap where a group border falls between two columns', () => {
    const g = layout(
      'group g[G]\nservice a\nservice b in g\nservice c in g\na:R -- L:b\nb:R -- L:c',
    )
    const gap = (p: string, q: string) =>
      centre(node(g, q)).x - centre(node(g, p)).x
    expect(gap('b', 'c')).toBe(200)
    expect(gap('a', 'b')).toBe(240)
    const box = g.groups[0]!
    expect(box.x).toBeLessThan(node(g, 'b').x)
    expect(box.x + box.width).toBeGreaterThan(node(g, 'c').x + 80)
  })

  it('nests a group inside its parent with padding on every side', () => {
    const g = layout(
      'group outer[O]\ngroup inner[I] in outer\nservice a in inner\nservice b in outer\na:R -- L:b',
    )
    const outer = g.groups[0]!
    const inner = outer.children[0]!
    expect(inner.x - outer.x).toBeGreaterThanOrEqual(40)
    expect(inner.y - outer.y).toBeGreaterThanOrEqual(40)
    expect(outer.x + outer.width - (inner.x + inner.width)).toBeGreaterThan(40)
  })

  it('lays out a left-to-right chain along x and separates unlinked pieces', () => {
    const g = layout(
      'service a\nservice b\nservice c\nservice d\na:R -- L:b\nc:R -- L:d',
    )
    expect(node(g, 'b').x).toBeGreaterThan(node(g, 'a').x)
    expect(node(g, 'c').x).toBeGreaterThan(node(g, 'b').x + 80)
    expect(node(g, 'c').y).toBe(node(g, 'a').y)
  })

  it('lays out a top-to-bottom chain along y', () => {
    const g = layout('service a\nservice b\na:B -- T:b')
    expect(node(g, 'b').y).toBeGreaterThan(node(g, 'a').y)
    expect(node(g, 'b').x).toBe(node(g, 'a').x)
  })

  it('joins a diagonal pair with one elbow, in either direction', () => {
    for (const side of ['B', 'T']) {
      const g = layout(
        `service a\nservice b\nservice c\na:R -- L:b\na:${side} -- ${side === 'B' ? 'T' : 'B'}:c\nc:R -- B:b\nc:L -- R:b`,
      )
      expect(g.edges.some((e) => e.points.length === 3)).toBe(true)
    }
  })

  it('attaches a {group} edge to the group border', () => {
    const g = layout('group g[G]\nservice a in g\nservice b\na{group}:R -- L:b')
    const box = g.groups[0]!
    const e = g.edges[0]!
    expect(e.points[0]!.x).toBe(box.x + box.width)
  })

  it('draws a reversed edge from the cell it starts in', () => {
    const g = layout('service a\nservice b\nb:L --> R:a')
    const e = g.edges[0]!
    expect(e.hasArrowStart).toBe(true)
    expect(e.points[0]!.x).toBeLessThan(e.points[1]!.x)
  })

  it('draws an empty group as a padded point', () => {
    const g = layout('group g[G]\nservice a')
    expect(g.groups[0]!.width).toBe(80)
  })
})
