/**
 * #1287: composite states join the reading-order layout of #1240. A
 * composite's ELK compound node used to be appended after every top-level
 * leaf, so under `MODEL_ORDER` it counted as coming last and edges into it
 * read as back-edges. It now sits at its first-mention position among its
 * siblings, and the diagram runs top to bottom in source order.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../index.ts'
import { layoutGraphSync } from '@zombie-mermaid/svg-renderer'
import type { PositionedGraph, PositionedNode } from '@zombie-mermaid/core'

function layout(src: string): PositionedGraph {
  return layoutGraphSync(parseMermaid(src))
}

function node(g: PositionedGraph, id: string): PositionedNode {
  const n = g.nodes.find((x) => x.id === id)
  if (!n) throw new Error(`no node ${id}`)
  return n
}

const startOf = (g: PositionedGraph) =>
  g.nodes.find((n) => n.shape === 'state-start')!
const endOf = (g: PositionedGraph) =>
  g.nodes.find((n) => n.shape === 'state-end' && n.id === '_end')!

function expectAscendingY(g: PositionedGraph, ids: PositionedNode[]): void {
  const ys = ids.map((n) => n.y)
  expect(ys).toEqual([...ys].sort((a, b) => a - b))
  expect(new Set(ys).size).toBe(ys.length)
  void g
}

describe('composite state diagrams read in source order (#1287)', () => {
  it('the Composite States sample runs start, Idle, Processing, Complete/Error, end', () => {
    const g = layout(`stateDiagram-v2
  [*] --> Idle
  Idle --> Processing : submit
  state Processing {
    parse --> validate
    validate --> execute
  }
  Processing --> Complete : done
  Processing --> Error : fail
  Error --> Idle : retry
  Complete --> [*]`)
    expectAscendingY(g, [
      startOf(g),
      node(g, 'Idle'),
      node(g, 'parse'),
      node(g, 'validate'),
      node(g, 'execute'),
      node(g, 'Complete'),
      endOf(g),
    ])
    expect(node(g, 'Error').y).toBeGreaterThan(node(g, 'execute').y)
  })

  it('a composite between two leaves stays between them despite a back-edge', () => {
    const g = layout(`stateDiagram-v2
  [*] --> A
  A --> Box : go
  state Box {
    x --> y
  }
  Box --> B : done
  B --> A : again
  B --> [*]`)
    expectAscendingY(g, [
      startOf(g),
      node(g, 'A'),
      node(g, 'x'),
      node(g, 'y'),
      node(g, 'B'),
      endOf(g),
    ])
  })

  it('a composite declared before its first transition still takes its source position', () => {
    const g = layout(`stateDiagram-v2
  state Box {
    x --> y
  }
  [*] --> A
  A --> Box
  Box --> B
  B --> [*]`)
    expectAscendingY(g, [
      startOf(g),
      node(g, 'A'),
      node(g, 'x'),
      node(g, 'y'),
      node(g, 'B'),
      endOf(g),
    ])
  })

  it('two composites in a chain keep their declaration order', () => {
    const g = layout(`stateDiagram-v2
  [*] --> One
  One --> Two
  state One {
    a --> b
  }
  state Two {
    c --> d
  }
  Two --> [*]`)
    expectAscendingY(g, [
      startOf(g),
      node(g, 'a'),
      node(g, 'b'),
      node(g, 'c'),
      node(g, 'd'),
      endOf(g),
    ])
  })
})
