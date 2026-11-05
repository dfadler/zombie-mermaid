import { describe, expect, it } from 'vitest'
import {
  facts,
  hash,
  norm,
  ourLabels,
  slug,
} from '../scripts/lib/samples-oracle-facts.ts'

describe('samples-oracle-facts', () => {
  it('slugs titles the way snapshot names do', () => {
    expect(slug('  Fan-In (LR)! ')).toBe('fan-in-lr')
  })

  it('reads our rendered labels, or the error for bad input', () => {
    expect(ourLabels('graph TD\n A[Start] --> B[End]', undefined)).toEqual(
      expect.arrayContaining(['Start', 'End']),
    )
    expect(ourLabels('not a diagram at all', undefined)).toHaveProperty('error')
  })

  it('counts nodes, edges, markers and text in a mermaid svg', () => {
    const svg =
      '<svg><marker id="m1"/><g class="node default"><span>Hi</span></g>' +
      '<path class="edge-thickness-normal" marker-end="url(#m1)"/></svg>'
    expect(facts(svg)).toEqual({
      nodes: 1,
      edgePaths: 1,
      markers: ['m1'],
      markerRefs: ['m1'],
      text: ['Hi'],
    })
  })

  it('normalises Iconify ids and hashes to 10 hex chars', () => {
    expect(norm('a IconifyId1f2 b')).toBe('a IconifyId b')
    expect(hash('x')).toMatch(/^[0-9a-f]{10}$/)
  })
})
