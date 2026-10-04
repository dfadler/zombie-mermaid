/**
 * #1284: `besideCellsFree` decides whether a label placed beside a reciprocal
 * pair's stroke would sit on something the layout already fixed. Rendered
 * diagrams rarely reach each rejection (the pair's column is widened to hold
 * its labels), so each one is pinned here on a hand-built graph, as
 * ascii-draw-arrows-single-point-path.test.ts does for `drawArrow`.
 *
 * Grid: every column 4 wide and every row 4 tall, so grid (gx, gy) draws at
 * (4 * gx + 2, 4 * gy + 2).
 */
import { describe, it, expect } from 'vitest'
import { besideCellsFree, strokeShift } from '../draw-arrows.ts'
import { Down } from '../types.ts'
import { mkCanvas, mkRoleCanvas } from '../canvas.ts'
import type {
  AsciiEdge,
  AsciiGraph,
  AsciiNode,
  AsciiSubgraph,
  GridCoord,
} from '../types.ts'
import { createGrid } from '../grid-occupancy.ts'

function makeNode(name: string, x: number, y: number): AsciiNode {
  return {
    name,
    displayLabel: name,
    shape: 'rectangle',
    index: 0,
    gridCoord: { x: 0, y: 0 },
    drawingCoord: { x, y },
    drawing: mkCanvas(4, 3), // 5 wide, 4 tall
    drawn: false,
    styleClassName: '',
    styleClass: { name: '', styles: {} },
  }
}

function makeEdge(
  from: AsciiNode,
  to: AsciiNode,
  path: GridCoord[],
): AsciiEdge {
  return {
    from,
    to,
    text: '',
    path,
    labelLine: [],
    startDir: Down,
    endDir: Down,
    style: 'solid',
    hasArrowStart: false,
    hasArrowEnd: true,
  }
}

function makeSubgraph(
  nodes: AsciiNode[],
  box: { minX: number; minY: number; maxX: number; maxY: number },
): AsciiSubgraph {
  return { name: 'Frame', nodes, parent: null, children: [], ...box }
}

function makeGraph(
  nodes: AsciiNode[],
  edges: AsciiEdge[] = [],
  subgraphs: AsciiSubgraph[] = [],
): AsciiGraph {
  const columnWidth = new Map<number, number>()
  const rowHeight = new Map<number, number>()
  for (let i = 0; i < 6; i++) {
    columnWidth.set(i, 4)
    rowHeight.set(i, 4)
  }
  return {
    nodes,
    edges,
    canvas: mkCanvas(40, 40),
    roleCanvas: mkRoleCanvas(40, 40),
    grid: createGrid(),
    columnWidth,
    rowHeight,
    subgraphs,
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

const label = (x: number, y: number, text = 'ab') => [{ x, y, text }]

describe('besideCellsFree (#1284)', () => {
  const a = makeNode('A', 0, 0) // occupies x 0..4, y 0..3
  const b = makeNode('B', 0, 20)

  it('accepts a label with nothing under it', () => {
    const edge = makeEdge(a, b, [])
    expect(
      besideCellsFree(makeGraph([a, b], [edge]), edge, label(10, 10)),
    ).toBe(true)
  })

  it('rejects a label that starts left of the canvas', () => {
    const edge = makeEdge(a, b, [])
    expect(
      besideCellsFree(makeGraph([a, b], [edge]), edge, label(-1, 10)),
    ).toBe(false)
  })

  it('rejects a label on a node box', () => {
    const edge = makeEdge(a, b, [])
    const graph = makeGraph([a, b], [edge])
    expect(besideCellsFree(graph, edge, label(2, 1))).toBe(false)
    // One row below the box is clear.
    expect(besideCellsFree(graph, edge, label(2, 4))).toBe(true)
  })

  it('ignores a node that has not been placed yet', () => {
    const unplaced: AsciiNode = { ...makeNode('C', 0, 0), drawingCoord: null }
    const edge = makeEdge(a, b, [])
    const graph = makeGraph([unplaced], [edge])
    expect(besideCellsFree(graph, edge, label(2, 1))).toBe(true)
  })

  describe('subgraph frames', () => {
    const inner = makeNode('In', 40, 40)
    const box = { minX: 10, minY: 5, maxX: 20, maxY: 15 }

    it('rejects a label crossing a side wall', () => {
      const edge = makeEdge(a, b, [])
      const graph = makeGraph([a, b], [edge], [makeSubgraph([inner], box)])
      expect(besideCellsFree(graph, edge, label(9, 8, 'abc'))).toBe(false)
      expect(besideCellsFree(graph, edge, label(19, 8, 'abc'))).toBe(false)
    })

    it('rejects a label on the title row or the bottom wall', () => {
      const edge = makeEdge(a, b, [])
      const graph = makeGraph([a, b], [edge], [makeSubgraph([inner], box)])
      expect(besideCellsFree(graph, edge, label(12, 5))).toBe(false)
      expect(besideCellsFree(graph, edge, label(12, 6))).toBe(false) // one-line title
      expect(besideCellsFree(graph, edge, label(12, 15))).toBe(false)
    })

    it('accepts a label inside the frame, clear of its walls and title', () => {
      const edge = makeEdge(a, b, [])
      const graph = makeGraph([a, b], [edge], [makeSubgraph([inner], box)])
      expect(besideCellsFree(graph, edge, label(12, 9))).toBe(true)
    })

    it('ignores a frame with no nodes', () => {
      const edge = makeEdge(a, b, [])
      const graph = makeGraph([a, b], [edge], [makeSubgraph([], box)])
      expect(besideCellsFree(graph, edge, label(9, 8, 'abc'))).toBe(true)
    })
  })

  describe('other edges', () => {
    // A vertical path down grid column 3 (drawing x = 14), rows 0..3.
    const other = (): AsciiEdge =>
      makeEdge(a, b, [
        { x: 3, y: 0 },
        { x: 3, y: 3 },
      ])

    it('rejects a label on another edge path', () => {
      const edge = makeEdge(a, b, [])
      const graph = makeGraph([a, b], [edge, other()])
      expect(besideCellsFree(graph, edge, label(13, 6))).toBe(false)
    })

    it('accepts a label beside, above or below that path', () => {
      const edge = makeEdge(a, b, [])
      const graph = makeGraph([a, b], [edge, other()])
      expect(besideCellsFree(graph, edge, label(10, 6))).toBe(true) // x 10..11
      expect(besideCellsFree(graph, edge, label(13, 20))).toBe(true) // below it
    })

    it("does not count the edge's own path", () => {
      const edge = other()
      const graph = makeGraph([a, b], [edge])
      expect(besideCellsFree(graph, edge, label(13, 6))).toBe(true)
    })
  })

  it('rejects when any one line of a multi-line label is blocked', () => {
    const edge = makeEdge(a, b, [])
    const graph = makeGraph([a, b], [edge])
    const lines = [
      { x: 10, y: 10, text: 'ab' },
      { x: 10, y: 3, text: 'cd' }, // last row of node A, but x is clear
      { x: 2, y: 2, text: 'ef' }, // on node A
    ]
    expect(besideCellsFree(graph, edge, lines)).toBe(false)
    expect(besideCellsFree(graph, edge, lines.slice(0, 2))).toBe(true)
  })
})

describe('strokeShift on a hand-built reciprocal pair (#1284)', () => {
  /**
   * A (grid column 1, row 0) and B (column 1, row 2) joined by A->B going
   * down and B->A going up, both straight along column 1: drawing x = 6,
   * from y = 6 to y = 14. A label sits 2 cells right of the down stroke
   * (x = 9) and ends 2 cells left of the up stroke (x = 3).
   */
  function pair(
    over: {
      narrow?: boolean
      sameDirection?: boolean
      downText?: string
      upText?: string
    } = {},
  ) {
    const a = makeNode('A', 3, 0)
    const b = makeNode('B', 3, 16)
    if (over.narrow) a.drawing = mkCanvas(2, 3) // 3 wide
    const down = makeEdge(a, b, [
      { x: 1, y: 1 },
      { x: 1, y: 3 },
    ])
    const up = makeEdge(b, a, [
      over.sameDirection ? { x: 1, y: 1 } : { x: 1, y: 3 },
      over.sameDirection ? { x: 1, y: 3 } : { x: 1, y: 1 },
    ])
    down.labelLine = down.path
    up.labelLine = up.path
    down.text = over.downText ?? 'x'
    up.text = over.upText ?? 'y'
    const graph = makeGraph([a, b], [down, up])
    return { graph, a, b, down, up }
  }

  it('shifts the down edge right and the up edge left when everything is clear', () => {
    const { graph, down, up } = pair()
    expect(strokeShift(graph, down)).toBe(1)
    expect(strokeShift(graph, up)).toBe(-1)
  })

  it('stays centred when a box is too narrow to hold two strokes', () => {
    const { graph, down } = pair({ narrow: true })
    expect(strokeShift(graph, down)).toBe(0)
  })

  it('stays centred when both edges run the same way', () => {
    const { graph, down } = pair({ sameDirection: true })
    expect(strokeShift(graph, down)).toBe(0)
  })

  it('stays centred when the pair is not on one grid column', () => {
    const { graph, up } = pair()
    up.path = [
      { x: 2, y: 3 },
      { x: 2, y: 1 },
    ]
    expect(strokeShift(graph, up)).toBe(0)
  })

  it('stays centred for a self-loop and for an edge with no partner', () => {
    const { graph, a, b, down } = pair()
    expect(strokeShift(graph, makeEdge(a, a, down.path))).toBe(0)
    graph.edges = [down]
    expect(strokeShift(graph, down)).toBe(0)
    expect(strokeShift(graph, makeEdge(b, a, down.path))).toBe(0)
  })

  it('does not treat an edge that merely names a cluster source as a cluster exit', () => {
    const { graph, a, down, up } = pair()
    down.clusterSource = makeSubgraph([a], {
      minX: 100,
      minY: 100,
      maxX: 120,
      maxY: 120,
    })
    graph.clusterExitPlans = new Map()
    expect(strokeShift(graph, down)).toBe(1)
    expect(strokeShift(graph, up)).toBe(-1)
  })
})
