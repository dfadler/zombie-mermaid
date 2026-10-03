/**
 * Regression tests for #1283 — an edge addressed to a subgraph id
 * (`Y --> Sub`) ends at the cluster's flow-side wall, as real mermaid draws
 * it, and the cluster is ranked past the sources of such edges.
 *
 * Before, the converter's stand-in member took the arrow into the frame
 * (past the wall, with a junction glyph where it crossed), and a source with
 * a parent landed level with the cluster's entry member, inside the frame's
 * span, so its edge ran sideways across the wall.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { convertToAsciiGraph } from '../converter.ts'
import { createMapping } from '../grid.ts'
import { buildClusterEntryRoute } from '../cluster-boundary.ts'
import { determinePath } from '../edge-routing.ts'
import { drawArrow } from '../draw-arrows.ts'
import { gridKey } from '../types.ts'
import type { AsciiGraph } from '../types.ts'

const frame = `
subgraph Sub
A-->B
A-->C
end`

function lines(source: string): string[] {
  return renderMermaidASCII(source).split('\n')
}

/** Index of the line holding the frame's top wall. */
function topWall(rows: string[]): number {
  const i = rows.findIndex((r) => /^┌─+┐\s*$/.test(r))
  if (i < 0) throw new Error(`no intact top wall in:\n${rows.join('\n')}`)
  return i
}

describe('ASCII: edges addressed to a subgraph end at its wall (#1283)', () => {
  it('TD: both arrows stop on the line above an unbroken top wall', () => {
    const rows = lines(`graph TD\nX-->Sub\nW-->Y\nY-->Sub${frame}`)
    const wall = topWall(rows)
    const above = rows[wall - 1]!
    // One arrowhead per source, each directly above the wall.
    expect([...above].filter((c) => c === '▼')).toHaveLength(2)
    // Nothing crosses into the frame: no junction glyph on the wall row.
    expect(rows[wall]).not.toMatch(/[┼┬┴]/)
  })

  it('TD: W sits directly above Y, and Y above the frame', () => {
    const rows = lines(`graph TD\nX-->Sub\nW-->Y\nY-->Sub${frame}`)
    const col = (label: string): number => {
      const row = rows.find((r) => r.includes(`│ ${label} │`))!
      return row.indexOf(`│ ${label} │`)
    }
    const rowOf = (label: string): number =>
      rows.findIndex((r) => r.includes(`│ ${label} │`))
    expect(col('W')).toBe(col('Y'))
    expect(rowOf('W')).toBeLessThan(rowOf('Y'))
    expect(rowOf('Y')).toBeLessThan(topWall(rows))
  })

  it('LR: the arrow stops one cell before the left wall, label clear of the node', () => {
    const rows = lines(`graph LR\nX-->Sub\nW-->Y\nY-->|go|Sub${frame}`)
    const xRow = rows.find((r) => r.includes('│ X ├'))!
    expect(xRow).toMatch(/►│ │ A/)
    const yRow = rows.find((r) => r.includes('│ Y ├'))!
    expect(yRow).toMatch(/│ Y ├go─+►│/)
  })

  it('keeps a direct edge to a member on ordinary routing', () => {
    const rows = lines(`graph TD${frame}\nX-->A`)
    // The arrow enters the frame and lands on A, as before.
    // The wall row is crossed here, so find it from the title row below it.
    const wall = rows.findIndex((r) => r.includes('Sub')) - 1
    const a = rows.findIndex((r) => /[│├┤] A [│├┤]/.test(r))
    expect(rows.slice(wall + 1, a).some((r) => r.includes('▼'))).toBe(true)
  })

  it('places every node when the cluster is also reached from below', () => {
    // C is downstream of the cluster and edges back into it: the cluster
    // cannot wait for C, so it is placed on what is known.
    const out = renderMermaidASCII(
      `graph TD\nsubgraph Sub\nA-->B\nend\nB-->C\nC-->Sub\nX-->Sub`,
    )
    for (const id of ['A', 'B', 'C', 'X']) {
      expect(out).toMatch(new RegExp(`[│├┤] ${id} [│├┤]`))
    }
  })
})

function layout(source: string, direction: 'TD' | 'LR' = 'TD'): AsciiGraph {
  const graph = convertToAsciiGraph(parseMermaid(source), {
    useAscii: false,
    paddingX: 6,
    paddingY: 5,
    boxBorderPadding: 1,
    graphDirection: direction,
  })
  createMapping(graph)
  return graph
}

function node(graph: AsciiGraph, name: string) {
  const found = graph.nodes.find((n) => n.name === name)
  if (!found) throw new Error(`no node ${name}`)
  return found
}

describe('ASCII: edge cases of the cluster-entry shape (#1283)', () => {
  const simple = `graph TD\nX-->Sub\nW\nsubgraph Sub\nA-->B\nend`

  function entry(graph: AsciiGraph) {
    const edge = graph.edges.find((e) => e.clusterTarget)
    if (!edge) throw new Error('no cluster-addressed edge')
    return edge
  }

  it('routes to a gutter cell in the source column, just above the frame', () => {
    const graph = layout(simple)
    const route = buildClusterEntryRoute(graph, entry(graph))
    expect(route).not.toBeNull()
    const last = route!.path[route!.path.length - 1]!
    expect(last.x).toBe(node(graph, 'X').gridCoord!.x + 1)
    expect(last.y).toBe(node(graph, 'A').gridCoord!.y - 1)
  })

  it('declines when the source has not been placed', () => {
    const graph = layout(simple)
    const edge = entry(graph)
    const saved = edge.from.gridCoord
    edge.from.gridCoord = null
    try {
      expect(buildClusterEntryRoute(graph, edge)).toBeNull()
    } finally {
      edge.from.gridCoord = saved
    }
  })

  it('declines when the cluster has no placed members', () => {
    const graph = layout(simple)
    const edge = entry(graph)
    const emptied = { ...edge.clusterTarget!, nodes: [] }
    expect(
      buildClusterEntryRoute(graph, { ...edge, clusterTarget: emptied }),
    ).toBeNull()
  })

  it('declines when the source is a member of the cluster', () => {
    const graph = layout(simple)
    const edge = entry(graph)
    expect(
      buildClusterEntryRoute(graph, { ...edge, from: node(graph, 'A') }),
    ).toBeNull()
  })

  it('declines when the target is not a member of the cluster', () => {
    const graph = layout(simple)
    const edge = entry(graph)
    expect(
      buildClusterEntryRoute(graph, { ...edge, to: node(graph, 'W') }),
    ).toBeNull()
  })

  it('declines when the gutter cell is taken', () => {
    const graph = layout(simple)
    const edge = entry(graph)
    const gutter = buildClusterEntryRoute(graph, edge)!.path.at(-1)!
    graph.grid.add(gridKey(gutter))
    expect(buildClusterEntryRoute(graph, edge)).toBeNull()
  })

  it('declines when no route to the gutter can be found', () => {
    const graph = layout(simple)
    graph.pathBudget = { remaining: 0 }
    expect(buildClusterEntryRoute(graph, entry(graph))).toBeNull()
  })

  it('LR: a label widens a gutter column that has no width yet', () => {
    const graph = layout(
      `graph LR\nX-->|go|Sub\nsubgraph Sub\nA-->B\nend`,
      'LR',
    )
    const edge = entry(graph)
    const gutter = edge.path.at(-1)!
    graph.columnWidth.delete(gutter.x)
    determinePath(graph, edge)
    expect(graph.columnWidth.get(gutter.x)).toBe('go'.length + 5)
  })

  it('TD: draws up to the wall, but not past a wall the last leg cannot reach', () => {
    const graph = layout(simple)
    const edge = entry(graph)
    const heads = (): string[] => drawArrow(graph, edge)[2].flat()
    expect(heads()).toContain('▼')
    // With the wall moved above the leg's start the path ends where it is.
    edge.clusterTarget!.minY = 0
    expect(heads()).toContain('▼')
  })

  it('TD: a label on an entry edge still ends the arrow at an unbroken wall', () => {
    const rows = lines(`graph TD\nX-->|go|Sub\nsubgraph Sub\nA-->B\nend`)
    const wall = topWall(rows)
    expect(rows.join('\n')).toContain('go')
    expect(rows[wall - 1]).toContain('▼')
  })

  it('TD: tight padding keeps the arrow above the wall, not on it', () => {
    const out = renderMermaidASCII(
      `graph TD\nX-->Sub\nsubgraph Sub\nA-->B\nend`,
      { paddingY: 1 },
    ).split('\n')
    const wall = topWall(out)
    expect(out[wall - 1]).toContain('▼')
    expect(out[wall]).not.toContain('▼')
  })

  it('LR: padding too tight to fit an arrow still renders every node', () => {
    const out = renderMermaidASCII(
      `graph LR\nX-->Sub\nsubgraph Sub\nA-->B\nend`,
      { paddingX: 1 },
    )
    for (const id of ['X', 'A', 'B']) {
      expect(out).toMatch(new RegExp(`[│├┤] ${id} [│├┤]`))
    }
  })

  it('drops an edge to an empty subgraph without placing a phantom node', () => {
    const out = renderMermaidASCII(`graph TD\nX-->Sub\nsubgraph Sub\nend`)
    expect(out).toMatch(/│ X │/)
    expect(out).not.toContain('Sub')
  })

  it('does not count an edge from inside the cluster as a source to clear', () => {
    // B is placed first (it has its own parent Q). B --> Sub is internal, so
    // it must not push the entry member A below B (its own
    // successor).
    const graph = layout(
      `graph TD\nX-->Sub\nQ-->B\nsubgraph Sub\nA-->B\nend\nB-->Sub`,
    )
    expect(node(graph, 'A').gridCoord!.y).not.toBeGreaterThan(
      node(graph, 'B').gridCoord!.y,
    )
  })

  it('places every node for a member that points at its own cluster', () => {
    const graph = layout(`graph TD\nsubgraph Sub\nA-->B\nend\nA-->Sub`)
    expect(graph.nodes.every((n) => n.gridCoord)).toBe(true)
  })

  it('places every node for two edges from one source to one cluster', () => {
    const graph = layout(
      `graph TD\nX-->Sub\nX-.->Sub\nsubgraph Sub\nA-->B\nend`,
    )
    expect(graph.nodes.every((n) => n.gridCoord)).toBe(true)
    expect(graph.edges.filter((e) => e.clusterTarget)).toHaveLength(2)
  })
})
