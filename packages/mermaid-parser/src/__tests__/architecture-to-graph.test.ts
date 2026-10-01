import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import { parseArchitecture, architectureToGraph } from '../index.ts'

const lower = (b: string) =>
  architectureToGraph(
    parseArchitecture(splitStatements(`architecture-beta\n${b}`)),
  )
const two = 'service a\nservice b\n'

describe('architectureToGraph', () => {
  it('maps icons to shapes and unknown icons to rectangles', () => {
    const g = lower(
      'service a(database)\nservice b(disk)\nservice c(cloud)\nservice d(internet)\nservice e(server)\nservice f("logos:aws")\nservice g',
    )
    const shapes = [...g.nodes.values()].map((n) => n.shape)
    expect(shapes).toEqual([
      'cylinder',
      'cylinder',
      'stadium',
      'circle',
      'rectangle',
      'rectangle',
      'rectangle',
    ])
  })

  it('nests groups three deep and places nodes in their own group', () => {
    const g = lower(
      'group a\ngroup b in a\ngroup c in b\nservice s in c\nservice t in a\njunction j in b',
    )
    const a = g.subgraphs[0]!
    expect(g.subgraphs).toHaveLength(1)
    expect(a.nodeIds).toEqual(['t'])
    expect(a.children[0]?.id).toBe('b')
    expect(a.children[0]?.nodeIds).toEqual(['j'])
    expect(a.children[0]?.children[0]).toMatchObject({
      id: 'c',
      nodeIds: ['s'],
    })
  })

  it('keeps sibling top-level groups as separate roots', () => {
    const g = lower('group a\ngroup b\nservice s in a\nservice t in b')
    expect(g.subgraphs.map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('draws a junction as an unlabelled filled circle', () => {
    expect(lower('junction j').nodes.get('j')).toEqual({
      id: 'j',
      label: '',
      shape: 'filled-circle',
    })
  })

  describe('{group} edges', () => {
    it('attaches the source end to the enclosing group', () => {
      const [e] = lower(
        'group g\nservice a in g\nservice b\na{group}:R -- L:b',
      ).edges
      expect(e).toMatchObject({ source: 'g', target: 'b' })
    })

    it('attaches the target end to the enclosing group', () => {
      const [e] = lower(
        'group g\nservice a in g\nservice b\nb:R -- L:a{group}',
      ).edges
      expect(e).toMatchObject({ source: 'b', target: 'g' })
    })

    it('attaches both ends, and uses the immediate (innermost) group', () => {
      const [e] = lower(
        'group o\ngroup i in o\nservice a in i\njunction j in o\na{group}:R -- L:j{group}',
      ).edges
      expect(e).toMatchObject({ source: 'i', target: 'o' })
    })

    it('follows an edge reversal', () => {
      const [e] = lower(
        'group g\nservice a in g\nservice b\na{group}:L -- R:b',
      ).edges
      expect(e).toMatchObject({ source: 'b', target: 'g' })
    })
  })

  describe('flow direction', () => {
    it.each([
      ['a:R -- L:b', 'LR'],
      ['a:L -- R:b', 'LR'],
      ['a:B -- T:b', 'TB'],
      ['a:T -- B:b', 'TB'],
      // Tie goes to LR.
      ['a:R -- T:b', 'LR'],
      ['a:R -- L:b\na:R -- B:b\na:T -- B:b', 'LR'],
      ['a:B -- T:b\na:R -- B:b', 'TB'],
    ])('%j -> %s', (edges, dir) => {
      expect(lower(two + edges).direction).toBe(dir)
    })

    it('defaults to LR with no edges', () => {
      expect(lower('service a').direction).toBe('LR')
    })
  })

  describe('edge reversal', () => {
    it.each([
      // [edge, source, target, arrowStart, arrowEnd]
      ['a:R -- L:b', 'a', 'b'],
      ['a:L -- R:b', 'b', 'a'],
      ['a:R -- R:b', 'a', 'b'],
      // A back-side target port wins: the edge is not reversed.
      ['a:L -- L:b', 'a', 'b'],
    ])('LR: %s runs %s -> %s', (edge, source, target) => {
      const [e] = lower(two + edge).edges
      expect([e?.source, e?.target]).toEqual([source, target])
    })

    it.each([
      ['a:B -- T:b', 'a', 'b'],
      ['a:T -- B:b', 'b', 'a'],
    ])('TB: %s runs %s -> %s', (edge, source, target) => {
      const [e] = lower(two + edge).edges
      expect([e?.source, e?.target]).toEqual([source, target])
    })

    it('does not reverse an edge whose ports are on the other axis', () => {
      // Direction is TB (two vertical edges outweigh one horizontal), and
      // L/R ports say nothing about top/bottom order.
      const g = lower(two + 'a:L -- R:b\na:B -- T:b\na:B -- T:b')
      expect(g.direction).toBe('TB')
      expect([g.edges[0]?.source, g.edges[0]?.target]).toEqual(['a', 'b'])
    })

    it.each([
      ['a:R -- L:b', false, false],
      ['a:R --> L:b', false, true],
      ['a:R <-- L:b', true, false],
      ['a:R <--> L:b', true, true],
    ])('keeps arrowheads on %s', (edge, start, end) => {
      expect(lower(two + edge).edges[0]).toMatchObject({
        hasArrowStart: start,
        hasArrowEnd: end,
        style: 'solid',
      })
    })

    it.each([
      // Reversed edges swap which end carries the arrowhead.
      ['a:L --> R:b', true, false],
      ['a:L <-- R:b', false, true],
      ['a:L <--> R:b', true, true],
      ['a:L -- R:b', false, false],
    ])('swaps arrowheads when reversing %s', (edge, start, end) => {
      expect(lower(two + edge).edges[0]).toMatchObject({
        source: 'b',
        target: 'a',
        hasArrowStart: start,
        hasArrowEnd: end,
      })
    })
  })

  it('carries no flowchart styling', () => {
    const g = lower(two + 'a:R -- L:b')
    expect(g.classDefs.size).toBe(0)
    expect(g.nodeStyles.size).toBe(0)
    expect(g.linkStyles.size).toBe(0)
  })
})
