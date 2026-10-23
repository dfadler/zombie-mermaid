/**
 * #2110: when ELK staggers a layer's nodes, `alignLayerNodes` snaps them to one
 * line. A node that moves up into its edge's cross-flow run left the run lying
 * on the node's top face and the arrowhead half-clipped. The last leg of every
 * edge into the layer must keep room for a whole arrowhead.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { layoutFlowchartSync } from '@zombie-mermaid/svg-renderer'
import { ARROW_HEAD } from '../styles.ts'

const SOURCE = `flowchart TD
  In[Request] --> A
  subgraph Cluster
    A --> B
    B --> C
  end
  Cluster --> X[Cache]
  Cluster --> Y[Log]
  B --> Z[Audit]
  C --> W[Reply]`

describe('arrowheads into the layer below a subgraph (#2110)', () => {
  const layout = layoutFlowchartSync(parseMermaid(SOURCE))

  it.each([
    ['Cluster', 'X'],
    ['Cluster', 'Y'],
    ['B', 'Z'],
    ['C', 'W'],
  ])('%s -> %s ends in a vertical leg as long as the arrowhead', (s, t) => {
    const e = layout.edges.find((x) => x.source === s && x.target === t)!
    const [prev, last] = e.points.slice(-2) as [
      (typeof e.points)[0],
      (typeof e.points)[0],
    ]
    const target = layout.nodes.find((n) => n.id === t)!
    expect(last.y).toBeCloseTo(target.y, 1)
    expect(prev.x).toBeCloseTo(last.x, 1)
    expect(last.y - prev.y).toBeGreaterThanOrEqual(ARROW_HEAD.width)
  })
})
