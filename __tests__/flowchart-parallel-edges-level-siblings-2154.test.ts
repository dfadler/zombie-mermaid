/**
 * #2154: six or more labelled edges to one target dropped it a layer below its
 * sibling (ELK counted the parallel edges as a high-degree node), and eight or
 * more did the same through post-compaction. mermaid 12.1.0 and 12.2.0 keep
 * the two targets level at any count.
 */
import { describe, it, expect } from 'vitest'
import { layoutFlowchartSync } from '@zombie-mermaid/svg-renderer'
import { parseMermaid } from '../src/index.ts'

function levelGap(count: number, withCluster: boolean): number {
  const edges = Array.from({ length: count }, (_, i) => `  S -->|${i}| T`).join(
    '\n',
  )
  const head = withCluster
    ? 'flowchart TD\n  subgraph S [Cluster]\n    a\n  end\n  Start --> S'
    : 'flowchart TD\n  Start --> S'
  const g = layoutFlowchartSync(
    parseMermaid(`${head}\n${edges}\n  S -->|other| U`),
  )
  const y = (id: string): number => g.nodes.find((x) => x.id === id)!.y
  return Math.abs(y('T') - y('U'))
}

describe('parallel labelled edges keep sibling targets level (#2154)', () => {
  it.each([5, 6, 7, 8, 9, 12])('%i edges, plain source', (n) => {
    expect(levelGap(n, false)).toBeLessThan(1)
  })
  it.each([5, 6, 7, 8, 9, 12])('%i edges, subgraph source', (n) => {
    expect(levelGap(n, true)).toBeLessThan(1)
  })
})
