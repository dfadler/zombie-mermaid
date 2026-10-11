import { describe, it, expect } from 'vitest'
import { parseSequenceDiagram } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG } from '../../../../src/index.ts'
import { layoutSequenceDiagram } from '../sequence/layout.ts'

const SRC = [
  'participant C as Client',
  'participant S as Server',
  'C->>+S: Request',
  'S->>+S: Process',
  'S->>-S: Done',
  'S-->>-C: Response',
]

describe('nested self-message activation (#1241)', () => {
  const layout = layoutSequenceDiagram(
    parseSequenceDiagram(SRC.map((text, line) => ({ text, line }))),
  )
  const server = layout.activations.filter((a) => a.actorId === 'S')

  it('yields two activations on the actor with depths 0 and 1', () => {
    expect(server.map((a) => a.depth)).toEqual([0, 1])
  })

  it('offsets the nested bar right by half a bar, inside the parent span', () => {
    const outer = server.find((a) => a.depth === 0)!
    const inner = server.find((a) => a.depth === 1)!
    expect(inner.x - outer.x).toBe(outer.width / 2)
    expect(inner.topY).toBeGreaterThan(outer.topY)
    expect(inner.bottomY).toBeLessThan(outer.bottomY)
  })

  it('draws both bars, outer first so the nested one is painted on top', () => {
    const svg = renderMermaidSVG(`sequenceDiagram\n  ${SRC.join('\n  ')}`)
    expect(svg.match(/class="activation"/g)).toHaveLength(2)
  })
})
