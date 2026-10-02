/**
 * Regression tests for #1288 — "ASCII: edge joins a single-node subgraph's
 * node box instead of its frame (damaged corner)."
 *
 * Two side-by-side root frames that touched were separated by
 * `ensureSubgraphSpacing` moving the right frame's left wall. That is only
 * safe while the wall stays clear of the frame's own members: with a
 * single-node frame the wall landed on the node box's left column, and the
 * edge entering the frame drew a `├` over the box corner.
 * `widenGapsForFrameTitles` now widens the column gap instead when the pushed
 * wall would reach a member.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../parser.ts'
import { convertToAsciiGraph } from '../../packages/ascii-renderer/src/converter.ts'
import { createMapping } from '../../packages/ascii-renderer/src/grid.ts'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import type { AsciiConfig } from '../../packages/ascii-renderer/src/types.ts'

const SOURCE = `graph TD
  subgraph SA[Alpha]
    A
  end
  subgraph SB[Beta]
    B
  end
  X-->A
  X-->B`

describe('ASCII: single-node subgraph frames keep a margin around the node (#1288)', () => {
  it('leaves at least one blank column between each frame wall and its node', () => {
    const config: AsciiConfig = {
      useAscii: false,
      paddingX: 5,
      paddingY: 5,
      boxBorderPadding: 1,
      graphDirection: 'TD',
    }
    const graph = convertToAsciiGraph(parseMermaid(SOURCE), config)
    createMapping(graph)

    expect(graph.subgraphs).toHaveLength(2)
    for (const sg of graph.subgraphs) {
      const node = sg.nodes[0]!
      const x = node.drawingCoord!.x
      expect(sg.minX).toBeLessThan(x - 1)
      expect(sg.maxX).toBeGreaterThan(x + node.drawing!.length)
    }
  })

  it('draws both node boxes with intact corners', () => {
    const out = renderMermaidASCII(SOURCE)
    const lines = out.split('\n')
    // The X box plus the A and B boxes: every top edge is a plain ┌───┐.
    expect(out.match(/┌───┐/g)).toHaveLength(3)
    // No junction glyph may replace a node box's left corner.
    expect(lines.some((l) => /│ [├┤┼]───┐/.test(l))).toBe(false)
  })

  it('keeps pushing the wall (no extra gap) when the wide-titled frame has room', () => {
    // The right frame's title is wide, so after the left wall push it still
    // fits and stays clear of its node: the original narrowing path applies.
    const out = renderMermaidASCII(`graph TD
  subgraph SA[Alpha Gamma Delta Long]
    A
  end
  subgraph SB[Beta]
    B
  end
  X-->A
  X-->B`)
    expect(out).toContain('Alpha Gamma Delta Long')
    expect(out).toContain('Beta')
    // Frames stay separated by a blank column, not touching.
    expect(out).toMatch(/┐ ┌─/)
    expect(out.match(/┌───┐/g)).toHaveLength(3)
  })
})
