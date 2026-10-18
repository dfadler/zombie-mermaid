import { describe, expect, it } from 'vitest'
import { UnsupportedFlowchartError } from '@zombie-mermaid/elk-layout'
import { renderFlowchartAscii, rasterizeLayout } from '../src/index.ts'

describe('renderFlowchartAscii', () => {
  it('draws mermaid source as boxes with the node labels', async () => {
    const { text, stats } = await renderFlowchartAscii(
      'flowchart TD\n  A[Start] --> B[End]',
    )
    expect(text).toContain('Start')
    expect(text).toContain('End')
    expect(stats.edges).toBe(1)
  })

  it('propagates UnsupportedFlowchartError so callers can fall back', async () => {
    await expect(
      renderFlowchartAscii('flowchart TD\n  subgraph S\n    A --> B\n  end'),
    ).rejects.toBeInstanceOf(UnsupportedFlowchartError)
  })

  it('returns an empty drawing for a layout with no nodes', () => {
    const r = rasterizeLayout({ dir: 'TD', nodes: [], edges: [] })
    expect(r.text).toBe('')
    expect(r.boxes).toEqual([])
    expect(r.stats.edges).toBe(0)
  })
})
