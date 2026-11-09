// ============================================================================
// C4 row placement, following Mermaid's own C4 renderer.
//
// Mermaid does not rank C4 shapes by their relationships. It places them in
// rows in declaration order: four shapes to a row (`c4ShapeInRow`; the 1440px
// width limit wraps first, sooner for shapes wider than 216px), boundaries two to a row,
// a boundary's own shapes above its child boundaries. `Rel_U/D/L/R` and the render direction do not move
// anything. This ports the x-axis half of that algorithm
// (packages/svg-renderer/src/c4/layout.ts, from c4Renderer.ts in mermaid
// 12.3.0) to find where each row breaks; the ASCII renderer then sizes the
// rows in characters.
// ============================================================================

import { c4TypeLine } from '@zombie-mermaid/mermaid-parser'
import type {
  C4Boundary,
  C4Diagram,
  C4Element,
} from '@zombie-mermaid/mermaid-parser'
import {
  C4,
  C4_TEXT_WIDTH,
  c4ShapeSize,
  c4TextWidth,
  wrapToWidth,
} from '@zombie-mermaid/core'

// Mermaid's default `c4` config, as in the SVG renderer's metrics.
const MARGIN_X = 50
const SHAPE_MARGIN = 50
const BOUNDARY_IN_ROW = 2
const SCREEN_WIDTH = 1440

/**
 * A shape's width in mermaid's pixels: `c4.width` (216), or its text plus
 * padding when wider, and a queue adds its caps. The same rule as the SVG
 * layout (both use `c4ShapeSize`), so a wide name or description moves a row
 * break here exactly as it does in mermaid.
 */
function shapeWidth(el: C4Element): number {
  const nameLines = wrapToWidth(el.label, C4_TEXT_WIDTH, C4.nameSize)
  const descriptionLines = el.description
    ? wrapToWidth(el.description, C4_TEXT_WIDTH, C4.descrSize)
    : []
  const textWidth = Math.max(
    // Regular weight: mermaid sizes the layout slot from the wrapped text
    // before drawing the name in bold, so a bold name can overflow the slot.
    ...nameLines.map((l) => c4TextWidth(l, C4.nameSize, 400)),
    c4TextWidth(c4TypeLine(el), C4.typeSize, 400),
    ...descriptionLines.map((l) => c4TextWidth(l, C4.descrSize, 400)),
  )
  return c4ShapeSize(el, nameLines.length, descriptionLines.length, textWidth)
    .width
}

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
function insert(b: Bounds, width: number): boolean {
  let startx =
    b.nextStartx === b.nextStopx
      ? b.nextStopx + SHAPE_MARGIN
      : b.nextStopx + SHAPE_MARGIN * 2
  let stopx = startx + width
  let wrapped = false
  if (startx >= b.limit || stopx >= b.limit) {
    startx = b.nextStartx + SHAPE_MARGIN
    b.nextStopx = stopx = startx + width
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
      if (insert(bounds, shapeWidth(el)) || frame.shapeRows.length === 0) {
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
      bounds.stopx = bounds.startx + C4.width
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
