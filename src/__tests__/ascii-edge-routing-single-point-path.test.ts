/**
 * Regression test for #153 — `determineLabelLine`'s final fallback assumed
 * a routed edge's path always has at least 2 points:
 *
 *   largestLine = segments[0]?.line ?? [edge.path[0]!, edge.path[1]!]
 *
 * `pathfinder.ts`'s `getPath` can legitimately return a single-point path
 * when a routed edge's preferred from/to grid coordinates coincide (e.g.
 * closely-spaced/adjacent nodes). With a 1-element `edge.path`, `segments`
 * stays empty (the `for (let i = 1; i < pathLen; i++)` loop never runs),
 * so the fallback read `edge.path[1]` — actually `undefined`, mistyped as
 * `GridCoord` — and crashed a few lines later when it was dereferenced.
 *
 * Fixed by treating a path with fewer than 2 points as a degenerate
 * zero-length line at that single point instead of indexing past the end.
 */
import { describe, it, expect } from 'vitest'
import { determineLabelLine } from '../ascii/edge-routing.ts'
import { Down } from '../ascii/types.ts'
import type { AsciiEdge, AsciiGraph, AsciiNode } from '../ascii/types.ts'
import { createGrid } from '../ascii/grid-occupancy.ts'

function makeNode(name: string, x: number, y: number): AsciiNode {
  return {
    name,
    displayLabel: name,
    shape: 'rectangle',
    index: 0,
    gridCoord: { x, y },
    drawingCoord: null,
    drawing: null,
    drawn: false,
    styleClassName: '',
    styleClass: { name: '', styles: {} },
  }
}

function makeGraph(nodes: AsciiNode[]): AsciiGraph {
  return {
    nodes,
    edges: [],
    canvas: [],
    roleCanvas: [],
    grid: createGrid(),
    columnWidth: new Map(),
    rowHeight: new Map(),
    subgraphs: [],
    config: {
      useAscii: false,
      paddingX: 5,
      paddingY: 5,
      boxBorderPadding: 1,
      graphDirection: 'TD',
    },
    offsetX: 0,
    offsetY: 0,
    bundles: [],
  }
}

describe('determineLabelLine handles a single-point edge path (#153)', () => {
  it('does not throw when edge.path has exactly one point', () => {
    const from = makeNode('A', 0, 0)
    const to = makeNode('B', 4, 0)
    const graph = makeGraph([from, to])

    const edge: AsciiEdge = {
      from,
      to,
      text: 'label',
      path: [{ x: 2, y: 0 }], // single-point path — the coinciding-endpoint case
      labelLine: [],
      startDir: Down,
      endDir: Down,
      style: 'solid',
      hasArrowStart: false,
      hasArrowEnd: true,
    }

    expect(() => determineLabelLine(graph, edge)).not.toThrow()
  })

  it('does not throw when edge.path is empty', () => {
    const from = makeNode('A', 0, 0)
    const to = makeNode('B', 4, 0)
    const graph = makeGraph([from, to])

    const edge: AsciiEdge = {
      from,
      to,
      text: 'label',
      path: [],
      labelLine: [],
      startDir: Down,
      endDir: Down,
      style: 'solid',
      hasArrowStart: false,
      hasArrowEnd: true,
    }

    expect(() => determineLabelLine(graph, edge)).not.toThrow()
  })
})
