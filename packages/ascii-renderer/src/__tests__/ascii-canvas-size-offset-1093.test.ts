/**
 * Regression for a bug found while investigating PR #1093 (the #1067 fix):
 * `setCanvasSizeToGrid`/`setRoleCanvasSizeToGrid` sized the canvas from
 * `columnWidth`/`rowHeight` alone, with no way to account for
 * `graph.offsetX`/`offsetY` — the shift `offsetDrawingForSubgraphs` applies
 * whenever a subgraph's own border padding would otherwise push its content
 * negative. Every `gridToDrawingCoord` call (including edge line-drawing)
 * adds that offset to its result, but `createMapping` sized the canvas
 * *before* the offset was known, leaving it exactly `offsetX`/`offsetY` too
 * small. Node boxes were retroactively shifted into the correct position,
 * but nothing widened the canvas array to match — so any edge line whose
 * drawing coordinate landed in that unreserved margin was silently dropped
 * by `write()`'s out-of-bounds clip. This surfaced as a fully disconnected
 * edge (a dangling corner glyph with no line connecting it to its node) in
 * the "State: Composite States" sample's `Error --> Idle : retry` edge,
 * once the #1067 chain-overlap fix rerouted that edge through a column
 * further right than anything else in the diagram — see that sample's
 * regenerated baseline in this same PR.
 */
import { describe, it, expect } from 'vitest'
import {
  mkCanvas,
  mkRoleCanvas,
  setCanvasSizeToGrid,
  setRoleCanvasSizeToGrid,
  getCanvasSize,
} from '../canvas.ts'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

describe('setCanvasSizeToGrid / setRoleCanvasSizeToGrid — offset', () => {
  it('reserves extra width/height for a nonzero offset', () => {
    const canvas = mkCanvas(0, 0)
    const columnWidth = new Map([
      [0, 3],
      [1, 4],
    ])
    const rowHeight = new Map([
      [0, 2],
      [1, 5],
    ])
    setCanvasSizeToGrid(canvas, columnWidth, rowHeight, 6, 3)
    const [maxX, maxY] = getCanvasSize(canvas)
    // columnWidth sums to 7, plus an offset of 6 => max valid index 12.
    expect(maxX).toBe(12)
    // rowHeight sums to 7, plus an offset of 3 => max valid index 9.
    expect(maxY).toBe(9)
  })

  it('matches the un-offset canvas size when offset is omitted (default 0)', () => {
    const canvas = mkCanvas(0, 0)
    const columnWidth = new Map([[0, 5]])
    const rowHeight = new Map([[0, 4]])
    setCanvasSizeToGrid(canvas, columnWidth, rowHeight)
    const [maxX, maxY] = getCanvasSize(canvas)
    expect(maxX).toBe(4)
    expect(maxY).toBe(3)
  })

  it('role canvas sizing accepts the same offset', () => {
    const roleCanvas = mkRoleCanvas(0, 0)
    const columnWidth = new Map([[0, 3]])
    const rowHeight = new Map([[0, 2]])
    setRoleCanvasSizeToGrid(roleCanvas, columnWidth, rowHeight, 5, 1)
    expect(roleCanvas.length - 1).toBe(7)
    expect((roleCanvas[0]?.length ?? 1) - 1).toBe(2)
  })
})

describe('subgraph-offset edges reach their node border (#1093 regression)', () => {
  it("draws the retry edge's connector all the way into Error's box, with no gap", () => {
    const src = `stateDiagram-v2
  [*] --> Idle
  Idle --> Processing : submit
  state Processing {
    parse --> validate
    validate --> execute
  }
  Processing --> Complete : done
  Processing --> Error : fail
  Error --> Idle : retry
  Complete --> [*]`

    const lines = renderMermaidASCII(src, { colorMode: 'none' }).split('\n')
    const errorRow = lines.find((l) => l.includes('Error'))
    expect(errorRow).toBeDefined()

    // Error's own right border ('├', where the outgoing retry edge exits)
    // must be immediately followed by a drawn connector character, not a
    // gap — a disconnected edge leaves that cell (and the next) blank.
    const portIndex = errorRow!.indexOf('├')
    expect(portIndex).toBeGreaterThan(-1)
    const afterPort = errorRow!.slice(portIndex + 1)
    expect(afterPort).toMatch(/^[─┘└┐┌│]/)
  })
})
