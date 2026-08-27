/**
 * Regression test for the draw-arrows.ts sibling of the #153 bug fixed in
 * edge-routing.ts's determineLabelLine (see
 * ascii-edge-routing-single-point-path.test.ts).
 *
 * `pathfinder.ts`'s `getPath` can legitimately return a single-point path
 * when a routed edge's preferred from/to grid coordinates coincide (e.g.
 * closely-spaced/adjacent nodes). `drawArrow`'s `drawPath` helper only
 * pushes a drawn line segment for `i >= 1` in `edge.path`, so a one-element
 * path produces zero segments — and `drawArrow` used to index unconditionally
 * into the first/last entries of the resulting (empty) `linesDrawn` /
 * `lineDirs` arrays to draw the box-start connector and end arrowhead,
 * throwing "Cannot read properties of undefined" instead of rendering.
 *
 * Fixed by skipping the box-start connector and end arrowhead when no line
 * segment was drawn.
 */
import { describe, it, expect } from 'vitest'
import { drawArrow } from '../ascii/draw-arrows.ts'
import { Down } from '../ascii/types.ts'
import { mkCanvas, mkRoleCanvas } from '../ascii/canvas.ts'
import type { AsciiEdge, AsciiGraph, AsciiNode } from '../ascii/types.ts'
import { createGrid } from '../ascii/grid-occupancy.ts'

function makeNode(name: string, x: number, y: number): AsciiNode {
  return {
    name,
    displayLabel: name,
    shape: 'rectangle',
    index: 0,
    gridCoord: { x, y },
    drawingCoord: { x, y },
    drawing: mkCanvas(2, 2),
    drawn: false,
    styleClassName: '',
    styleClass: { name: '', styles: {} },
  }
}

function makeGraph(nodes: AsciiNode[]): AsciiGraph {
  return {
    nodes,
    edges: [],
    canvas: mkCanvas(10, 10),
    roleCanvas: mkRoleCanvas(10, 10),
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

describe('drawArrow handles a single-point edge path', () => {
  it('does not throw when edge.path has exactly one point', () => {
    const from = makeNode('A', 0, 0)
    const to = makeNode('B', 4, 0)
    const graph = makeGraph([from, to])

    const edge: AsciiEdge = {
      from,
      to,
      text: '',
      path: [{ x: 2, y: 0 }], // single-point path — the coinciding-endpoint case
      labelLine: [],
      startDir: Down,
      endDir: Down,
      style: 'solid',
      hasArrowStart: false,
      hasArrowEnd: true,
    }

    expect(() => drawArrow(graph, edge)).not.toThrow()
  })

  it('does not throw for a bidirectional edge with a single-point path', () => {
    const from = makeNode('A', 0, 0)
    const to = makeNode('B', 4, 0)
    const graph = makeGraph([from, to])

    const edge: AsciiEdge = {
      from,
      to,
      text: '',
      path: [{ x: 2, y: 0 }],
      labelLine: [],
      startDir: Down,
      endDir: Down,
      style: 'solid',
      hasArrowStart: true,
      hasArrowEnd: true,
    }

    expect(() => drawArrow(graph, edge)).not.toThrow()
  })
})
