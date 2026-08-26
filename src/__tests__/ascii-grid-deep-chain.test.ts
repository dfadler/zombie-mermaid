/**
 * Regression test for #153 — `createMapping`'s `highestPositionPerLevel`
 * level tracker was a fixed-size-100 array (`new Array(100).fill(0)`), but
 * each level down a chain adds 4 to the tracked coordinate. A chain deeper
 * than ~25 nodes (100 / 4) pushed the index past the preallocated bound,
 * silently reading `undefined` (asserted as `number`) and producing `NaN`
 * grid coordinates instead of throwing or laying out correctly.
 *
 * Fixed by making the tracker a sparse array with `?? 0` defaults on read,
 * so it grows with the chain instead of capping at a fixed depth.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../parser.ts'
import { convertToAsciiGraph } from '../ascii/converter.ts'
import { createMapping } from '../ascii/grid.ts'
import { renderMermaidASCII } from '../ascii/index.ts'
import type { AsciiConfig } from '../ascii/types.ts'

function longChainSource(depth: number): string {
  const lines = ['flowchart TD']
  for (let i = 1; i < depth; i++) {
    lines.push(`  n${i} --> n${i + 1}`)
  }
  return lines.join('\n')
}

describe('ASCII grid layout handles chains deeper than the old fixed-size level tracker (#153)', () => {
  it('lays out a 40-node chain with no NaN grid coordinates', () => {
    const source = longChainSource(40)
    const parsed = parseMermaid(source)
    const config: AsciiConfig = {
      useAscii: false,
      paddingX: 5,
      paddingY: 5,
      boxBorderPadding: 1,
      graphDirection: 'TD',
    }
    const graph = convertToAsciiGraph(parsed, config)
    createMapping(graph)

    expect(graph.nodes).toHaveLength(40)
    for (const node of graph.nodes) {
      expect(node.gridCoord).not.toBeNull()
      expect(Number.isFinite(node.gridCoord!.x)).toBe(true)
      expect(Number.isFinite(node.gridCoord!.y)).toBe(true)
    }

    // Each node in the chain should sit strictly deeper (larger y) than the
    // previous one — NaN corruption would break this monotonic ordering.
    const yById = new Map(graph.nodes.map((n) => [n.name, n.gridCoord!.y]))
    for (let i = 1; i < 40; i++) {
      const y = yById.get(`n${i}`)!
      const yNext = yById.get(`n${i + 1}`)!
      expect(yNext).toBeGreaterThan(y)
    }
  })

  it('renders a 40-node chain to ASCII without throwing or producing NaN in output', () => {
    const output = renderMermaidASCII(longChainSource(40))
    expect(output).not.toContain('NaN')
    expect(output).toContain('n1')
    expect(output).toContain('n40')
  })
})
