/**
 * #1239: in a flowchart with a cycle, ELK's own cycle breaking could reverse
 * the wrong edge and draw the whole diagram upside down (the Git Branching
 * sample started with `Tests?` at the far left). mermaid.js breaks the cycle
 * with a depth-first walk, reversing the edge that points back at a node still
 * on the walk's stack; handing ELK those edges already reversed gives the same
 * flow, and each is flipped back afterwards so it still runs source to target.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../index.ts'
import { layoutGraphSync } from '@zombie-mermaid/svg-renderer'
import { findBackEdgeIndexes } from '../../packages/svg-renderer/src/layout-engine/back-edges.ts'
import { edgesReversedForLayout } from '../../packages/svg-renderer/src/layout-engine/to-elk.ts'
import type { PositionedGraph } from '@zombie-mermaid/core'

const FLAT_CYCLE = `graph TD
  A[Push Code] --> B{Tests Pass?}
  B -->|Yes| C[Build Image]
  B -->|No| D[Fix & Retry]
  D -.-> A
  C --> E([Deploy Staging])
  E --> F{QA Approved?}
  F -->|Yes| G((Production))
  F -->|No| D`

const GIT_BRANCHING = `graph LR
  A[main] --> B[develop]
  B --> C[feature/auth]
  B --> D[feature/ui]
  C --> E{PR Review}
  D --> E
  E -->|approved| B
  B --> F[release/1.0]
  F --> G{Tests?}
  G -->|pass| A
  G -->|fail| F`

/** The edges of a graph as "A->B" strings for the given indices. */
function names(src: string, indices: Set<number>): string[] {
  const g = parseMermaid(src) as ReturnType<typeof parseMermaid> & {
    edges: Array<{ source: string; target: string }>
  }
  return [...indices].map((i) => `${g.edges[i]!.source}->${g.edges[i]!.target}`)
}

function centreOf(p: PositionedGraph, id: string): { x: number; y: number } {
  const n = p.nodes.find((q) => q.id === id)!
  return { x: n.x + n.width / 2, y: n.y + n.height / 2 }
}

describe('findBackEdgeIndexes', () => {
  const back = (src: string): string[] =>
    names(src, findBackEdgeIndexes(parseMermaid(src) as never))

  it('finds nothing in an acyclic graph', () => {
    expect(
      back('graph TD\n  A --> B\n  A --> C\n  B --> D\n  C --> D'),
    ).toEqual([])
  })

  it('reverses the edge that closes a simple cycle', () => {
    expect(back('graph TD\n  A --> B\n  B --> C\n  C --> A')).toEqual(['C->A'])
  })

  it('reverses a two-node cycle on the second edge', () => {
    expect(back('graph TD\n  A --> B\n  B --> A')).toEqual(['B->A'])
  })

  it('follows node order: the first-mentioned node is where the walk starts', () => {
    // B is mentioned first, so the walk starts at B and A -> B closes the cycle.
    expect(back('graph TD\n  B --> A\n  A --> B')).toEqual(['A->B'])
  })

  it('reverses D -.-> A in the CI/CD cycle, not F --> D', () => {
    // The walk A, B, C, E, F reaches D through F --> D before B --> D, so the
    // edge back to A is the one that closes the cycle.
    expect(back(FLAT_CYCLE)).toEqual(['D->A'])
  })

  it('does not count a cross edge to an already finished node', () => {
    // C is finished before D --> C is seen; that is a cross edge, not a back edge.
    expect(
      back('graph TD\n  A --> B\n  A --> C\n  B --> C\n  C --> D\n  D --> C'),
    ).toEqual(['D->C'])
  })

  it('ignores self-loops', () => {
    expect(back('graph TD\n  A --> A\n  A --> B')).toEqual([])
  })

  it('handles a very long chain without overflowing the stack', () => {
    const n = 20000
    const lines = ['graph TD']
    for (let i = 0; i < n; i++) lines.push(`  N${i} --> N${i + 1}`)
    lines.push(`  N${n} --> N0`)
    const g = parseMermaid(lines.join('\n'))
    expect(findBackEdgeIndexes(g as never).size).toBe(1)
  })
})

describe('edgesReversedForLayout', () => {
  it('is empty for a state diagram, which has its own cycle breaking', () => {
    const g = parseMermaid('stateDiagram-v2\n  [*] --> A\n  A --> B\n  B --> A')
    expect(edgesReversedForLayout(g as never).size).toBe(0)
  })

  it('is empty for a graph with a subgraph direction override', () => {
    const g = parseMermaid(
      'graph TD\n  subgraph s\n    direction LR\n    A --> B\n  end\n  B --> C\n  C --> A',
    )
    expect(edgesReversedForLayout(g as never).size).toBe(0)
  })

  it('is the DFS back edges for an ordinary flowchart, computed once', () => {
    const g = parseMermaid(FLAT_CYCLE)
    const a = edgesReversedForLayout(g as never)
    expect(a.size).toBe(1)
    expect(edgesReversedForLayout(g as never)).toBe(a)
  })
})

describe('layout of a flowchart with a cycle', () => {
  const p = layoutGraphSync(parseMermaid(FLAT_CYCLE))

  it('flows top to bottom, with Fix & Retry after QA Approved', () => {
    const y = (id: string): number => centreOf(p, id).y
    expect(y('A')).toBeLessThan(y('B'))
    expect(y('B')).toBeLessThan(y('C'))
    expect(y('C')).toBeLessThan(y('E'))
    expect(y('E')).toBeLessThan(y('F'))
    expect(y('F')).toBeLessThan(y('G'))
    // F --> D is a forward edge, so D is below F.
    expect(y('F')).toBeLessThan(y('D'))
  })

  it('keeps every edge running from its source to its target', () => {
    for (const e of p.edges) {
      const s = p.nodes.find((n) => n.id === e.source)!
      const t = p.nodes.find((n) => n.id === e.target)!
      const near = (
        pt: { x: number; y: number },
        n: { x: number; y: number; width: number; height: number },
      ): boolean =>
        pt.x >= n.x - 2 &&
        pt.x <= n.x + n.width + 2 &&
        pt.y >= n.y - 2 &&
        pt.y <= n.y + n.height + 2
      expect(near(e.points[0]!, s), `${e.source}->${e.target} start`).toBe(true)
      expect(near(e.points.at(-1)!, t), `${e.source}->${e.target} end`).toBe(
        true,
      )
    }
  })

  it('draws the back edge up the side, into the bottom of Push Code', () => {
    const e = p.edges.find((q) => q.source === 'D' && q.target === 'A')!
    const a = p.nodes.find((n) => n.id === 'A')!
    const d = p.nodes.find((n) => n.id === 'D')!
    expect(e.points[0]!.y).toBeCloseTo(d.y, 0) // leaves the top of Fix & Retry
    expect(e.points.at(-1)!.y).toBeCloseTo(a.y + a.height, 0) // enters A's bottom
  })
})

describe('Git Branching sample', () => {
  const p = layoutGraphSync(parseMermaid(GIT_BRANCHING))
  const x = (id: string): number => centreOf(p, id).x

  it('flows left to right from main, as mermaid.js draws it', () => {
    expect(x('A')).toBeLessThan(x('B'))
    expect(x('B')).toBeLessThan(x('C'))
    expect(x('C')).toBeLessThan(x('E'))
    expect(x('B')).toBeLessThan(x('F'))
    expect(x('F')).toBeLessThan(x('G'))
  })

  it('draws the edge from Tests? back to main as the one running against the flow', () => {
    const e = p.edges.find((q) => q.source === 'G' && q.target === 'A')!
    const start = e.points[0]!
    const end = e.points.at(-1)!
    expect(end.x).toBeLessThan(start.x)
  })
})
