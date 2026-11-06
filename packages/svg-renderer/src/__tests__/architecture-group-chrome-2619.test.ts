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

  it('keeps the pitch at one group border and widens it at each further one', () => {
    const g = layout(
      'group g[G]\nservice a\nservice b in g\nservice c in g\na:R -- L:b\nb:R -- L:c',
    )
    const gap = (p: string, q: string) =>
      centre(node(g, q)).x - centre(node(g, p)).x
    expect(gap('b', 'c')).toBe(200)
    // mermaid@12.3.0: a service beside a group stays 201.5 apart (#2682).
    expect(gap('a', 'b')).toBe(200)
    const box = g.groups[0]!
    expect(box.x).toBeLessThan(node(g, 'b').x)
    expect(box.x + box.width).toBeGreaterThan(node(g, 'c').x + 80)
  })

  it('spaces group beside group, and a service out of two nested groups, by 41.5 per extra border', () => {
    const sibs = layout(
      'group g1[G1]\ngroup g2[G2]\nservice a in g1\nservice b in g2\na:R -- L:b',
    )
    // mermaid@12.3.0 measures 243.2.
    expect(centre(node(sibs, 'b')).x - centre(node(sibs, 'a')).x).toBe(241.5)
    const deep = layout(
      'group g1[G1]\ngroup g2[G2] in g1\ngroup g3[G3] in g2\nservice a\nservice b in g3\na:R -- L:b',
    )
    // mermaid@12.3.0 measures 280.3.
    expect(centre(node(deep, 'b')).x - centre(node(deep, 'a')).x).toBe(283)
  })

  it('sizes groups like mermaid@12.3.0: 165x182 around one service, +83 per nesting level', () => {
    const g = layout(
      'group g1[G1]\ngroup g2[G2] in g1\ngroup g3[G3] in g2\nservice a in g3',
    )
    const sizes: number[][] = []
    for (let b = g.groups[0]; b; b = b.children[0])
      sizes.push([b.width, b.height])
    expect(sizes).toEqual([
      [331, 348],
      [248, 265],
      [165, 182],
    ])
  })

  it('pads a group around a junction as around a full tile', () => {
    const g = layout('group g[G]\njunction j in g')
    expect(g.groups[0]!.width).toBe(165)
    expect(g.groups[0]!.height).toBe(165)
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
    expect(g.groups[0]!.width).toBe(85)
  })
})
