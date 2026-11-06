// ============================================================================
// C4 row placement, following Mermaid's own C4 renderer.
//
// Mermaid does not rank C4 shapes by their relationships. It places them in
// rows in declaration order: four shapes to a row (`c4ShapeInRow`; the 1440px
// width limit always wraps first at 216px a shape), boundaries two to a row,
// a boundary's own shapes above its child boundaries. `Rel_U/D/L/R` and the render direction do not move
// anything. This ports the x-axis half of that algorithm
// (packages/svg-renderer/src/c4/layout.ts, from c4Renderer.ts in mermaid
// 12.3.0) to find where each row breaks; the ASCII renderer then sizes the
// rows in characters.
// ============================================================================

import type {
  C4Boundary,
  C4Diagram,
  C4Element,
} from '@zombie-mermaid/mermaid-parser'

// Mermaid's default `c4` config, as in the SVG renderer's metrics.
const MARGIN_X = 50
const SHAPE_MARGIN = 50
const BOUNDARY_IN_ROW = 2
const SCREEN_WIDTH = 1440
/** Every shape is `c4.width` (216px) wide unless its text is wider. */
// ponytail: wide text or a db/queue cap can push a shape past 216px in the SVG
// layout; this ignores that, so a row may break one shape earlier or later.
const SHAPE_WIDTH = 216

export interface C4Frame {
  /** The boundary this frame draws, or undefined for the unnamed root. */
  boundary: C4Boundary | undefined
  /** Own shapes, wrapped into rows. */
  shapeRows: C4Element[][]
  /** Child boundaries, `BOUNDARY_IN_ROW` to a row. */
  boundaryRows: C4Frame[][]
}

interface Bounds {
  startx: number
  stopx: number
  nextStartx: number
  nextStopx: number
  limit: number
}

const reset = (b: Bounds, x: number) => {
  b.startx = b.stopx = b.nextStartx = b.nextStopx = x
}

/** Mermaid's `Bounds.insert`, x only: returns true when the shape starts a row. */
function insert(b: Bounds): boolean {
  let startx =
    b.nextStartx === b.nextStopx
      ? b.nextStopx + SHAPE_MARGIN
      : b.nextStopx + SHAPE_MARGIN * 2
  let stopx = startx + SHAPE_WIDTH
  let wrapped = false
  if (startx >= b.limit || stopx >= b.limit) {
    startx = b.nextStartx + SHAPE_MARGIN
    b.nextStopx = stopx = startx + SHAPE_WIDTH
    wrapped = true
  }
  b.startx = Math.min(b.startx, startx)
  b.stopx = Math.max(b.stopx, stopx)
  b.nextStartx = Math.min(b.nextStartx, startx)
  b.nextStopx = Math.max(b.nextStopx, stopx)
  return wrapped
}

interface Source {
  boundary: C4Boundary | undefined
  elements: C4Element[]
  children: Source[]
}

function sources(diagram: C4Diagram): Source {
  const byAlias = new Map(diagram.elements.map((e) => [e.alias, e]))
  const inBoundary = new Set<string>()
  const walk = (b: C4Boundary): Source => ({
    boundary: b,
    elements: b.elementAliases.flatMap((a) => {
      inBoundary.add(a)
      const el = byAlias.get(a)
      return el ? [el] : []
    }),
    children: b.children.map(walk),
  })
  const children = diagram.boundaries.map(walk)
  return {
    boundary: undefined,
    elements: diagram.elements.filter((e) => !inBoundary.has(e.alias)),
    children,
  }
}

/** Mermaid's `drawInsideBoundary`, filling `out` with each frame's rows. */
function inside(
  parent: { startx: number; stopx: number; limit: number },
  srcs: Source[],
  out: C4Frame[],
): void {
  const bounds: Bounds = {
    startx: 0,
    stopx: 0,
    nextStartx: 0,
    nextStopx: 0,
    limit: parent.limit / Math.min(BOUNDARY_IN_ROW, srcs.length),
  }
  const rowFrames: C4Frame[] = []
  for (const [i, src] of srcs.entries()) {
    reset(
      bounds,
      i % BOUNDARY_IN_ROW === 0
        ? parent.startx + MARGIN_X
        : bounds.stopx !== bounds.startx
          ? bounds.stopx + MARGIN_X
          : bounds.startx,
    )
    const frame: C4Frame = {
      boundary: src.boundary,
      shapeRows: [],
      boundaryRows: [],
    }
    for (const el of src.elements) {
      if (insert(bounds) || frame.shapeRows.length === 0) {
        frame.shapeRows.push([])
      }
      frame.shapeRows.at(-1)!.push(el)
    }
    if (src.elements.length > 0) bounds.stopx += SHAPE_MARGIN
    if (src.children.length > 0) {
      const kids: C4Frame[] = []
      inside(bounds, src.children, kids)
      for (const [k, kid] of kids.entries()) {
        if (k % BOUNDARY_IN_ROW === 0) frame.boundaryRows.push([])
        frame.boundaryRows.at(-1)!.push(kid)
      }
    }
    if (src.boundary && bounds.stopx - bounds.startx === 0) {
      bounds.stopx = bounds.startx + SHAPE_WIDTH
    }
    parent.stopx = Math.max(bounds.stopx + SHAPE_MARGIN, parent.stopx)
    rowFrames.push(frame)
  }
  out.push(...rowFrames)
}

/** The unnamed root frame: shapes outside any boundary, then the boundaries. */
export function c4Rows(diagram: C4Diagram): C4Frame {
  const out: C4Frame[] = []
  inside(
    { startx: MARGIN_X, stopx: MARGIN_X, limit: SCREEN_WIDTH },
    [sources(diagram)],
    out,
  )
  return out[0]!
}
