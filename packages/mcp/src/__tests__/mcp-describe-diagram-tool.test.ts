import { describe, it, expect } from 'vitest'
import { describeDiagramHandler } from '../tools/describe-diagram.ts'

type Described = {
  direction: string
  nodes: unknown[]
  edges: { target: string }[]
  subgraphs: unknown[]
}

describe('describe_diagram', () => {
  it('returns nodes, edges and nested subgraphs', () => {
    const r = describeDiagramHandler({
      diagram:
        'flowchart LR\nsubgraph S[Group]\n  A[Start] -->|yes| B{Ok}\nend\nB --> C',
    })
    expect(r.isError).toBeUndefined()
    const s = r.structuredContent as unknown as Described
    expect(s.direction).toBe('LR')
    expect(s.nodes).toContainEqual({
      id: 'B',
      label: 'Ok',
      shape: 'diamond',
    })
    expect(s.edges[0]).toMatchObject({
      source: 'A',
      target: 'B',
      label: 'yes',
      hasArrowEnd: true,
    })
    expect(s.edges[1]).not.toHaveProperty('label')
    expect(s.subgraphs).toEqual([
      { id: 'S', label: 'Group', nodeIds: ['A', 'B'], children: [] },
    ])
  })

  it('handles state diagrams', () => {
    const r = describeDiagramHandler({
      diagram: 'stateDiagram-v2\n[*] --> Idle\nIdle --> Done',
    })
    const s = r.structuredContent as unknown as Described
    expect(s.edges.map((e) => e.target)).toContain('Done')
  })

  it('rejects other diagram types', () => {
    const r = describeDiagramHandler({ diagram: 'pie\n"A" : 1' })
    expect(JSON.stringify(r.content)).toContain('only flowchart')
    expect(r.isError).toBe(true)
  })

  it('reports parse errors', () => {
    const r = describeDiagramHandler({ diagram: 'graph XX\n  A --> B' })
    expect(r.isError).toBe(true)
  })
})
