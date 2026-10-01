import type {
  C4Boundary,
  C4Diagram,
  C4Element,
  C4Relationship,
  PositionedC4Boundary,
  PositionedC4Diagram,
  PositionedC4Element,
  PositionedC4Relationship,
} from '@zombie-mermaid/mermaid-parser'
import {
  c4BoundaryTypeLine,
  c4RelLabelLines,
  c4TypeLine,
} from '@zombie-mermaid/mermaid-parser'
import type { Point, RenderOptions } from '@zombie-mermaid/core'
import {
  C4,
  C4_TEXT_WIDTH,
  c4PersonGeometry,
  c4ShapeSize,
  c4TextWidth,
  wrapToWidth,
} from './metrics.ts'

// ============================================================================
// C4 layout, following Mermaid's own C4 renderer.
//
// Mermaid does not run a graph layout for C4. It places shapes in rows, in
// the order they are declared: up to `c4ShapeInRow` per row, boundaries
// `c4BoundaryInRow` to a row, each boundary wide enough for what it holds.
// Relationships are drawn afterwards between the shapes and never move
// anything, so `Rel_U/D/L/R` (and a render direction) have no effect on
// placement, as in Mermaid. This is a port of that algorithm
// (packages/mermaid/src/diagrams/c4/c4Renderer.ts), with text measured by
// estimate instead of in a browser.
// ============================================================================

/** Mermaid's `Bounds`: the extent of what has been placed in one boundary. */
interface Bounds {
  startx?: number
  stopx?: number
  starty?: number
  stopy?: number
  widthLimit?: number
  /** Where the next shape would go (Mermaid's `nextData`). */
  next: {
    startx?: number
    stopx?: number
    starty?: number
    stopy?: number
    cnt: number
  }
}

function newBounds(): Bounds {
  return { next: { cnt: 0 } }
}

function setData(
  b: Bounds,
  startx: number,
  stopx: number,
  starty: number,
  stopy: number,
): void {
  b.next.startx = b.startx = startx
  b.next.stopx = b.stopx = stopx
  b.next.starty = b.starty = starty
  b.next.stopy = b.stopy = stopy
}

function grow(
  obj: Bounds | Bounds['next'],
  key: 'startx' | 'stopx' | 'starty' | 'stopy',
  val: number,
  pick: (a: number, b: number) => number,
): void {
  const cur = obj[key]
  obj[key] = cur === undefined ? val : pick(val, cur)
}

/** Mermaid's `Bounds.insert`: give a shape the next free slot. */
function insert(b: Bounds, shape: Placed): void {
  b.next.cnt += 1
  const margin = C4.shapeMargin
  let startx =
    b.next.startx === b.next.stopx
      ? b.next.stopx! + margin
      : b.next.stopx! + margin * 2
  let stopx = startx + shape.width
  let starty = b.next.starty! + margin * 2
  let stopy = starty + shape.height
  if (
    startx >= b.widthLimit! ||
    stopx >= b.widthLimit! ||
    b.next.cnt > C4.shapeInRow
  ) {
    startx = b.next.startx! + margin + C4.nextLinePaddingX
    starty = b.next.stopy! + margin * 2
    b.next.stopx = stopx = startx + shape.width
    b.next.starty = b.next.stopy
    b.next.stopy = stopy = starty + shape.height
    b.next.cnt = 1
  }
  shape.x = startx
  shape.y = starty
  grow(b, 'startx', startx, Math.min)
  grow(b, 'starty', starty, Math.min)
  grow(b, 'stopx', stopx, Math.max)
  grow(b, 'stopy', stopy, Math.max)
  grow(b.next, 'startx', startx, Math.min)
  grow(b.next, 'starty', starty, Math.min)
  grow(b.next, 'stopx', stopx, Math.max)
  grow(b.next, 'stopy', stopy, Math.max)
}

interface Placed {
  x: number
  y: number
  width: number
  height: number
}

interface MeasuredElement extends Placed {
  el: C4Element
  nameLines: string[]
  descriptionLines: string[]
}

function measureElement(el: C4Element): MeasuredElement {
  const nameLines = wrapToWidth(el.label, C4_TEXT_WIDTH, C4.nameSize)
  const descriptionLines = el.description
    ? wrapToWidth(el.description, C4_TEXT_WIDTH, C4.descrSize)
    : []
  const textWidth = Math.max(
    ...nameLines.map((l) => c4TextWidth(l, C4.nameSize, 700)),
    c4TextWidth(c4TypeLine(el), C4.typeSize, 400),
    ...descriptionLines.map((l) => c4TextWidth(l, C4.descrSize, 400)),
  )
  const size = c4ShapeSize(
    el,
    nameLines.length,
    descriptionLines.length,
    textWidth,
  )
  return { el, nameLines, descriptionLines, x: 0, y: 0, ...size }
}

// A boundary as the layout walks it: its own shapes, then its children.
interface Frame {
  alias: string
  boundary?: C4Boundary
  elements: C4Element[]
  children: Frame[]
}

function buildFrames(diagram: C4Diagram): Frame {
  const inBoundary = new Set<string>()
  const byAlias = new Map(diagram.elements.map((e) => [e.alias, e]))
  const frame = (b: C4Boundary): Frame => {
    const elements = b.elementAliases.flatMap((a) => {
      inBoundary.add(a)
      const el = byAlias.get(a)
      return el ? [el] : []
    })
    return {
      alias: b.alias,
      boundary: b,
      elements,
      children: b.children.map(frame),
    }
  }
  const children = diagram.boundaries.map(frame)
  return {
    alias: 'global',
    elements: diagram.elements.filter((e) => !inBoundary.has(e.alias)),
    children,
  }
}

interface LaidOutBoundary extends PositionedC4Boundary {
  labelY: number
}

interface Layout {
  elements: Map<string, MeasuredElement>
  boundaries: LaidOutBoundary[]
  maxX: number
  maxY: number
}

function layoutFrames(root: Frame): Layout {
  const elements = new Map<string, MeasuredElement>()
  const boundaries: LaidOutBoundary[] = []
  let maxX: number = C4.diagramMarginX
  let maxY: number = C4.diagramMarginY

  // Mermaid's `drawC4ShapeArray`: measure, insert each, then bump the margin.
  const placeShapes = (bounds: Bounds, els: C4Element[]): void => {
    for (const el of els) {
      const m = measureElement(el)
      elements.set(el.alias, m)
      insert(bounds, m)
    }
    bounds.stopx! += C4.shapeMargin
    bounds.stopy! += C4.shapeMargin
  }

  // Mermaid's `drawInsideBoundary`.
  const inside = (parent: Bounds, frames: Frame[], depth: number): void => {
    const bounds = newBounds()
    bounds.widthLimit =
      parent.widthLimit! / Math.min(C4.boundaryInRow, frames.length)
    for (const [i, fr] of frames.entries()) {
      const b = fr.boundary
      // Height of the boundary's heading, which the shapes start below.
      let Y = 0
      const labelY = Y + 8
      Y = labelY + C4.boundaryLabelHeight
      let typeY: number | undefined
      const typeLine = b ? c4BoundaryTypeLine(b) : undefined
      if (typeLine) {
        typeY = Y + 5
        Y = typeY + C4.boundaryTypeHeight
      }
      let descrY: number | undefined
      if (b?.description) {
        descrY = Y + 20
        Y = descrY + C4.boundaryDescrHeight
      }
      // The unnamed root keeps a fixed heading height.
      if (!b) Y = C4.rootHeadingHeight

      if (i === 0 || i % C4.boundaryInRow === 0) {
        const x = parent.startx! + C4.diagramMarginX
        const y = parent.stopy! + C4.diagramMarginY + Y
        setData(bounds, x, x, y, y)
      } else {
        const x =
          bounds.stopx !== bounds.startx
            ? bounds.stopx! + C4.diagramMarginX
            : bounds.startx!
        setData(bounds, x, x, bounds.starty!, bounds.starty!)
      }

      if (fr.elements.length > 0) placeShapes(bounds, fr.elements)
      if (fr.children.length > 0) inside(bounds, fr.children, depth + 1)

      if (b) {
        let width = bounds.stopx! - bounds.startx!
        let height = bounds.stopy! - bounds.starty!
        // A boundary with nothing in it still gets a visible frame.
        if (width === 0) width = C4.width
        if (height === 0) height = Y + C4.shapeMargin
        boundaries.push({
          alias: b.alias,
          label: b.label,
          ...(b.type ? { type: b.type } : {}),
          ...(b.description ? { description: b.description } : {}),
          x: bounds.startx!,
          y: bounds.starty!,
          width,
          height,
          depth,
          labelY,
          ...(typeY === undefined ? {} : { typeY }),
          ...(descrY === undefined ? {} : { descrY }),
        })
      }
      parent.stopy = Math.max(bounds.stopy! + C4.shapeMargin, parent.stopy!)
      parent.stopx = Math.max(bounds.stopx! + C4.shapeMargin, parent.stopx!)
      maxX = Math.max(maxX, parent.stopx)
      maxY = Math.max(maxY, parent.stopy)
    }
  }

  const screen = newBounds()
  setData(
    screen,
    C4.diagramMarginX,
    C4.diagramMarginX,
    C4.diagramMarginY,
    C4.diagramMarginY,
  )
  screen.widthLimit = C4.screenWidth
  // The unnamed root is not drawn, so its children are the depth-0 boundaries.
  inside(screen, [root], -1)
  return { elements, boundaries, maxX, maxY }
}

/** Where the line from a box's centre toward `toward` leaves the box. */
function rectIntersect(box: Placed, toward: Point): Point {
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const dx = toward.x - cx
  const dy = toward.y - cy
  const w = box.width / 2
  const h = box.height / 2
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  let sx: number
  let sy: number
  if (Math.abs(dy) * w > Math.abs(dx) * h) {
    const half = dy < 0 ? -h : h
    sx = (half * dx) / dy
    sy = half
  } else {
    const half = dx < 0 ? -w : w
    sx = half
    sy = (half * dy) / dx
  }
  return { x: cx + sx, y: cy + sy }
}

/**
 * Where the line from a person's centre toward `toward` leaves the figure,
 * which is a round head over a pill, not the box around both (Mermaid clips
 * a relationship against what is drawn).
 */
function personIntersect(box: Placed, toward: Point): Point {
  const g = c4PersonGeometry(box.width)
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const headY = box.y + g.headRadius
  const pillTop = box.y + g.pillTop
  const pillBottom = box.y + box.height
  const inside = (x: number, y: number): boolean => {
    if (Math.hypot(x - cx, y - headY) <= g.headRadius) return true
    if (y < pillTop || y > pillBottom) return false
    // Round the pill's ends: each is a circle of radius `rx` (clamped).
    const r = Math.min(g.rx, (pillBottom - pillTop) / 2)
    const left = box.x + r
    const right = box.x + box.width - r
    const nearY = Math.min(Math.max(y, pillTop + r), pillBottom - r)
    const nearX = Math.min(Math.max(x, left), right)
    return (
      x >= box.x &&
      x <= box.x + box.width &&
      Math.hypot(x - nearX, y - nearY) <= r
    )
  }
  const len = Math.hypot(toward.x - cx, toward.y - cy)
  if (len === 0 || !inside(cx, cy)) return rectIntersect(box, toward)
  const ux = (toward.x - cx) / len
  const uy = (toward.y - cy) / len
  const at = (t: number): boolean => inside(cx + ux * t, cy + uy * t)
  let lo = 0
  let hi = 0.5
  while (at(hi) && hi < box.width + box.height) {
    lo = hi
    hi += 0.5
  }
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (at(mid)) lo = mid
    else hi = mid
  }
  return { x: cx + ux * lo, y: cy + uy * lo }
}

function leave(box: Placed, toward: Point): Point {
  return (box as Partial<MeasuredElement>).el?.kind === 'person'
    ? personIntersect(box, toward)
    : rectIntersect(box, toward)
}

const centre = (b: Placed): Point => ({
  x: b.x + b.width / 2,
  y: b.y + b.height / 2,
})

function routeRelationship(
  rel: C4Relationship,
  index: number,
  boxes: Map<string, Placed>,
  shift: number,
): PositionedC4Relationship {
  const a = boxes.get(rel.from)!
  const b = boxes.get(rel.to)!
  const start = leave(a, centre(b))
  const end = leave(b, centre(a))
  const dx = end.x - start.x
  const dy = end.y - start.y
  const shifted = (p: Point): Point => ({ x: p.x, y: p.y + shift })
  const out: PositionedC4Relationship = {
    ...rel,
    points: [shifted(start), shifted(end)],
  }
  // Mermaid draws the first relationship straight and every other one as a
  // quadratic curve bent toward the start of the chord.
  if (index > 0) {
    out.curve = shifted({
      x: start.x + dx / 2 - dx / 4,
      y: start.y + dy / 2,
    })
  }
  if (c4RelLabelLines(rel).length > 0) {
    const mid = {
      x: Math.min(start.x, end.x) + Math.abs(dx) / 2,
      y: Math.min(start.y, end.y) + Math.abs(dy) / 2,
    }
    // Mermaid hands its text routine the chord midpoint as the block's left
    // edge and centres the text in the block's width, so a label starts at
    // the midpoint and runs along the line rather than sitting on it.
    const head = c4RelLabelLines(rel)[0]
    const hasHead = rel.label !== '' || rel.index !== undefined
    const labelWidth = hasHead
      ? c4TextWidth(head ?? '', C4.messageSize, 400)
      : 0
    out.labelPosition = shifted({ x: mid.x + labelWidth / 2, y: mid.y })
    if (rel.technology) {
      const techWidth = c4TextWidth(`[${rel.technology}]`, C4.messageSize, 400)
      out.technologyX = mid.x + Math.max(labelWidth, techWidth) / 2
    }
  }
  return out
}

/** Lay out a parsed C4 diagram the way Mermaid's C4 renderer does. */
export function layoutC4DiagramSync(
  diagram: C4Diagram,
  _options: RenderOptions = {},
): PositionedC4Diagram {
  if (diagram.elements.length === 0 && diagram.boundaries.length === 0) {
    const empty: PositionedC4Diagram = {
      variant: diagram.variant,
      width: 0,
      height: 0,
      elements: [],
      boundaries: [],
      relationships: [],
    }
    if (diagram.title) empty.title = diagram.title
    return empty
  }

  const layout = layoutFrames(buildFrames(diagram))
  const titleExtra = diagram.title ? C4.titleExtra : 0
  // Mermaid's viewBox starts `diagramMarginY + titleExtra` above the content.
  const shift = C4.diagramMarginY + titleExtra

  const elements: PositionedC4Element[] = diagram.elements.flatMap((el) => {
    const m = layout.elements.get(el.alias)
    if (!m) return []
    return [
      {
        ...el,
        x: m.x,
        y: m.y + shift,
        width: m.width,
        height: m.height,
        nameLines: m.nameLines,
        descriptionLines: m.descriptionLines,
      },
    ]
  })

  // Outer boundaries first, so inner ones paint over them.
  const boundaries = [...layout.boundaries]
    .sort((p, q) => p.depth - q.depth)
    .map((b) => ({ ...b, y: b.y + shift }))

  const boxes = new Map<string, Placed>()
  for (const m of layout.elements.values()) boxes.set(m.el.alias, m)
  for (const b of layout.boundaries) boxes.set(b.alias, b)
  const relationships = diagram.relationships.map((r, i) =>
    routeRelationship(r, i, boxes, shift),
  )

  const width = layout.maxX + C4.diagramMarginX
  const height = layout.maxY + C4.diagramMarginY + titleExtra
  const positioned: PositionedC4Diagram = {
    variant: diagram.variant,
    width,
    height,
    elements,
    boundaries,
    relationships,
  }
  if (diagram.title) {
    positioned.title = diagram.title
    // Mermaid starts the title at `boxWidth / 2 - 4 * marginX`.
    const boxWidth = layout.maxX - C4.diagramMarginX
    positioned.titlePosition = {
      x: boxWidth / 2 - 4 * C4.diagramMarginX,
      y: C4.diagramMarginY + C4.diagramMarginY + shift,
    }
  }
  return positioned
}
