import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  mindmapMismatches,
  type OfficialMindmap,
} from '../scripts/lib/mindmap-agreement.ts'

// Mermaid 12.3.0's render of every `Mindmap:` sample, read back from the DOM
// by scripts/lib/mindmap-measure.ts (readOfficialMindmap).
const FIXTURE = JSON.parse(
  readFileSync(
    new URL('./fixtures/mindmap-official-12.3.0.json', import.meta.url),
    'utf8',
  ),
) as Record<string, { source: string; official: OfficialMindmap }>

describe('mindmap oracle agreement', () => {
  for (const [title, { source, official }] of Object.entries(FIXTURE)) {
    it(`agrees with mermaid 12.3.0 on "${title}"`, () => {
      expect(mindmapMismatches(source, official)).toEqual([])
    })
  }

  const basic = FIXTURE['Mindmap: Basic']!
  const clone = (): OfficialMindmap => structuredClone(basic.official)

  it('reports a different node count', () => {
    const o = clone()
    o.nodes.pop()
    expect(mindmapMismatches(basic.source, o)[0]).toMatch(/nodes: 9 official/)
  })

  it('reports structure differences', () => {
    const o = clone()
    o.nodes[1]!.classes = 'section-3 extra'
    o.nodes[2]!.shape = 'circle'
    o.nodes[3]!.lines = ['other']
    o.edges.pop()
    const out = mindmapMismatches(basic.source, o).join('\n')
    expect(out).toMatch(/node 1: section 3 official, 0 ours/)
    expect(out).toMatch(/node 1: classes "extra" official/)
    expect(out).toMatch(/node 2: shape circle official, default ours/)
    expect(out).toMatch(/node 3: text \["other"\]/)
    expect(out).toMatch(/edges: 9 official, 10 ours|no official edge/)
  })

  it('reports a wrong shape size, position and edge path', () => {
    const o = clone()
    o.nodes[0]!.width += 1
    o.nodes[2]!.x += 5
    o.edges[0]!.d = o.edges[0]!.d.replace('M', 'M1')
    o.edges[1]!.classes = 'edge'
    const out = mindmapMismatches(basic.source, o).join('\n')
    expect(out).toMatch(/node 0: shape/)
    expect(out).toMatch(/node 2: position off/)
    expect(out).toMatch(/edge 0_1: path differs/)
    expect(out).toMatch(/edge 1_2: classes/)
  })

  it('reports a shorter path as infinitely far', () => {
    const o = clone()
    o.edges[0]!.d = 'M0,0L1,1'
    expect(mindmapMismatches(basic.source, o).join('\n')).toMatch(
      /edge 0_1: path differs by Infinity/,
    )
  })
})
