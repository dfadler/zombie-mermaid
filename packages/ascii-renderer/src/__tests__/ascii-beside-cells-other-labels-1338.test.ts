/**
 * #1338: a beside-stroke label candidate must not share a cell with another
 * edge's label, since `drawGraph` merges label overlays last-wins and an
 * overlap would overwrite text. Not a confirmed user-visible defect (layout
 * widens the pair column to hold both labels); this is a defensive guard, so
 * each case probes `besideCellsFree` on a laid-out graph directly.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { convertToAsciiGraph } from '../converter.ts'
import { createMapping } from '../grid.ts'
import { besideCellsFree, edgeLabelPlacement } from '../draw-arrows.ts'
import { displayWidth } from '../display-width.ts'
import type { AsciiEdge, AsciiGraph } from '../types.ts'

function layout(source: string): AsciiGraph {
  const graph = convertToAsciiGraph(parseMermaid(source), {
    useAscii: false,
    paddingX: 6,
    paddingY: 5,
    boxBorderPadding: 1,
    graphDirection: 'TD',
  })
  createMapping(graph)
  return graph
}

/** A labelled edge, plus an unlabelled one to probe candidates on behalf of. */
function setup(label: string): {
  graph: AsciiGraph
  probe: AsciiEdge
  placed: { x: number; y: number; text: string }[]
} {
  const graph = layout(`graph TD\nA -->|${label}| B\nB --> C`)
  const labelled = graph.edges.find((e) => e.text.length > 0)
  const probe = graph.edges.find((e) => e.text.length === 0)
  const placed = labelled && edgeLabelPlacement(graph, labelled)
  if (!labelled || !probe || !placed) throw new Error('setup edges missing')
  return { graph, probe, placed }
}

describe('besideCellsFree rejects cells held by another edge label (#1338)', () => {
  it('rejects a candidate on the same cells as another label, accepts it moved clear', () => {
    const { graph, probe, placed } = setup('hello')
    const [line] = placed
    const sameCells = [{ x: line!.x, y: line!.y, text: 'hello' }]
    const clear = [{ x: line!.x + 40, y: line!.y, text: 'hello' }]
    expect(besideCellsFree(graph, probe, clear)).toBe(true)
    expect(besideCellsFree(graph, probe, sameCells)).toBe(false)
  })

  it('treats a one-cell overlap at either end as occupied, and adjacency as free', () => {
    const { graph, probe, placed } = setup('hello')
    const { x, y } = placed[0]!
    const w = displayWidth('hello')
    const at = (px: number) => [{ x: px, y, text: 'abc' }]
    expect(besideCellsFree(graph, probe, at(x + 40))).toBe(true)
    expect(besideCellsFree(graph, probe, at(x - 2))).toBe(false) // abc ends on x
    expect(besideCellsFree(graph, probe, at(x + w - 1))).toBe(false) // starts on last cell
    expect(besideCellsFree(graph, probe, at(x + w))).toBe(true)
    expect(besideCellsFree(graph, probe, [{ x: x - 1, y, text: 'a' }])).toBe(
      true,
    )
  })

  it('checks every line of a multiline label against the other label rows', () => {
    const { graph, probe, placed } = setup('hello')
    const { x, y } = placed[0]!
    // First line is clear; only the second line lands on the other label.
    const lines = [
      { x: x + 40, y: y - 1, text: 'top' },
      { x, y, text: 'bot' },
    ]
    expect(besideCellsFree(graph, probe, lines)).toBe(false)
    expect(
      besideCellsFree(graph, probe, [lines[0]!, { ...lines[1]!, x: x + 40 }]),
    ).toBe(true)
  })

  it('counts a wide glyph as two cells when comparing occupancy', () => {
    const { graph, probe, placed } = setup('日本語')
    const { x, y } = placed[0]!
    const w = displayWidth('日本語')
    expect(w).toBe(6)
    // A one-cell candidate on the last half of the final wide glyph overlaps;
    // a string-length count (3) would have missed it.
    expect(besideCellsFree(graph, probe, [{ x: x + 5, y, text: 'z' }])).toBe(
      false,
    )
    expect(besideCellsFree(graph, probe, [{ x: x + w, y, text: 'z' }])).toBe(
      true,
    )
  })
})
