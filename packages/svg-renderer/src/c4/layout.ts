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
  c4CylinderCap,
  c4PersonGeometry,
  c4QueueCap,
  c4ShapeSize,
  c4RelLabelBoxes,
  c4TextWidth,
  wrapToWidth,
} from './metrics.ts'
import type { C4LabelBox } from './metrics.ts'

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
        // Widen the bounds too, or the diagram width ignores the frame.
        if (width === 0) {
          width = C4.width
          bounds.stopx = bounds.startx! + width
        }
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
 * Where a line from the centre of a person toward `toward` leaves the figure.
 * Mermaid clips against the polygon it builds for the person (a round head
 * over a rounded body, 24 points on the head and 12 on each body corner), so
 * this builds the same polygon and returns the crossing nearest `toward`.
 */
function personIntersect(box: Placed, toward: Point): Point {
  const g = c4PersonGeometry(box.width, box.height)
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const w = box.width
  const h = box.height
  const headCentre = -h / 2 + g.headRadius
  const bodyTop = -h / 2 + g.pillTop
  const br = g.rx
  // `n` points on the circle at (ox, oy), sweeping from angle `from` to `to`
  // in degrees, with Mermaid's sign convention (`generateCirclePoints`).
  const arc = (
    ox: number,
    oy: number,
    r: number,
    n: number,
    from: number,
    to: number,
  ): Point[] =>
    Array.from({ length: n }, (_, i) => {
      const a = ((from + (i * (to - from)) / (n - 1)) * Math.PI) / 180
      return { x: ox - r * Math.cos(a), y: oy - r * Math.sin(a) }
    })
  // Where the head meets the body's top edge, below the head's centre.
  const phi =
    (Math.asin(Math.min(1, (bodyTop - headCentre) / g.headRadius)) * 180) /
    Math.PI
  const outline: Point[] = [
    ...arc(0, headCentre, g.headRadius, 24, 180 + phi, -phi),
    ...arc(-w / 2 + br, bodyTop + br, br, 12, 90, 0),
    ...arc(-w / 2 + br, h / 2 - br, br, 12, 360, 270),
    ...arc(w / 2 - br, h / 2 - br, br, 12, 270, 180),
    ...arc(w / 2 - br, bodyTop + br, br, 12, 180, 90),
  ]
  return nearestCrossing(
    { x: cx, y: cy },
    toward,
    outline.map((p) => ({ x: cx + p.x, y: cy + p.y })),
  )
}

/**
 * The crossing of segment `from`-`toward` with an edge `q1`-`q2`, as Mermaid's
 * (dagre's) `intersectLine` computes it: it adds half the determinant before
 * dividing, which rounds the result by up to half a pixel.
 */
function lineCrossing(
  from: Point,
  toward: Point,
  q1: Point,
  q2: Point,
): Point | undefined {
  const a1 = toward.y - from.y
  const b1 = from.x - toward.x
  const c1 = toward.x * from.y - from.x * toward.y
  const r3 = a1 * q1.x + b1 * q1.y + c1
  const r4 = a1 * q2.x + b1 * q2.y + c1
  if (r3 !== 0 && r4 !== 0 && r3 * r4 > 0) return undefined
  const a2 = q2.y - q1.y
  const b2 = q1.x - q2.x
  const c2 = q2.x * q1.y - q1.x * q2.y
  const r1 = a2 * from.x + b2 * from.y + c2
  const r2 = a2 * toward.x + b2 * toward.y + c2
  if (r1 !== 0 && r2 !== 0 && r1 * r2 > 0) return undefined
  const denom = a1 * b2 - a2 * b1
  if (denom === 0) return undefined
  const offset = Math.abs(denom / 2)
  let num = b1 * c2 - b2 * c1
  const x = num < 0 ? (num - offset) / denom : (num + offset) / denom
  num = a2 * c1 - a1 * c2
  const y = num < 0 ? (num - offset) / denom : (num + offset) / denom
  return { x, y }
}

/** The crossing of segment `from`-`toward` with the polygon nearest `toward`. */
function nearestCrossing(from: Point, toward: Point, poly: Point[]): Point {
  let best: Point | undefined
  let bestDist = Infinity
  poly.forEach((p, i) => {
    const hit = lineCrossing(from, toward, p, poly[(i + 1) % poly.length]!)
    if (!hit) return
    const d = Math.hypot(hit.x - toward.x, hit.y - toward.y)
    if (d < bestDist) {
      best = hit
      bestDist = d
    }
  })
  return best ?? from
}

/** Slack for deciding that a point sits exactly on a box edge. */
const EDGE = 1e-6

/**
 * A cylinder (`SystemDb`, `ContainerDb`) clips like Mermaid's: the point on
 * the bounding rectangle, then moved along the curve of the top or bottom cap
 * where the line meets a cap rather than the straight side.
 */
function cylinderIntersect(box: Placed, toward: Point): Point {
  const pos = rectIntersect(box, toward)
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const { rx, ry } = c4CylinderCap(box.width)
  const x = pos.x - cx
  const onCap =
    Math.abs(x) < box.width / 2 - EDGE ||
    (Math.abs(Math.abs(x) - box.width / 2) <= EDGE &&
      Math.abs(pos.y - cy) > box.height / 2 - ry)
  if (rx === 0 || !onCap) return pos
  const under = ry * ry * (1 - (x * x) / (rx * rx))
  let drop = ry - (under > 0 ? Math.sqrt(under) : under)
  if (toward.y - cy > 0) drop = -drop
  return { x: pos.x, y: pos.y + drop }
}

/** The same for a queue (`SystemQueue`, `ContainerQueue`), a cylinder on its side. */
function queueIntersect(box: Placed, toward: Point): Point {
  const pos = rectIntersect(box, toward)
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const { rx, ry } = c4QueueCap(box.height)
  const y = pos.y - cy
  const onCap =
    Math.abs(y) < box.height / 2 - EDGE ||
    (Math.abs(Math.abs(y) - box.height / 2) <= EDGE &&
      Math.abs(pos.x - cx) > box.width / 2 - rx)
  if (ry === 0 || !onCap) return pos
  const under = rx * rx * (1 - (y * y) / (ry * ry))
  let drop = rx - Math.sqrt(Math.abs(under))
  if (toward.x - cx > 0) drop = -drop
  return { x: pos.x + drop, y: pos.y }
}

function leave(box: Placed, toward: Point): Point {
  const el = (box as Partial<MeasuredElement>).el
  if (el?.kind === 'person') return personIntersect(box, toward)
  if (el?.shape === 'db') return cylinderIntersect(box, toward)
  if (el?.shape === 'queue') return queueIntersect(box, toward)
  return rectIntersect(box, toward)
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

/** A rectangle, as `x0..x1` by `y0..y1`. */
interface Rect {
  x0: number
  x1: number
  y0: number
  y1: number
}

/** Something a label should keep off, and how bad it is to land on it. */
interface Obstacle extends Rect {
  weight: number
}

/** Clear space kept between a label and anything it must avoid. */
const LABEL_CLEARANCE = 2
/** Extra space kept between a label and a shape, for the arrowhead. */
const SHAPE_CLEARANCE = 6
/** How far along the chord each trial position is from the last. */
const LABEL_STEP = 2
/** Offsets from the chord a label may try, nearest first (the label is 12px tall). */
const SIDE_STEPS = [0, 14, -14, 28, -28]
/** How wide each wrapped trial is, as a fraction of the label's own width. */
const WRAP_FRACTIONS = [0.75, 0.55, 0.4]
// What landing on each kind of obstacle costs: a shape is the worst (the text
// becomes unreadable), a frame line, heading or other label next, a line last.
const SHAPE_WEIGHT = 1000
const FRAME_WEIGHT = 100
const LINE_WEIGHT = 10
/** Space a label keeps from a boundary's dashed frame, and from its heading text. */
const FRAME_PAD = 2
const HEADING_PAD = 5
/** Spacing, in px along a line, of the points a relationship line is sampled at. */
const LINE_SAMPLE = 4

const rectOf = (b: C4LabelBox): Rect => ({
  x0: b.cx - b.w / 2,
  x1: b.cx + b.w / 2,
  y0: b.cy - b.h / 2,
  y1: b.cy + b.h / 2,
})

const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x0 < b.x1 + LABEL_CLEARANCE &&
  a.x1 > b.x0 - LABEL_CLEARANCE &&
  a.y0 < b.y1 + LABEL_CLEARANCE &&
  a.y1 > b.y0 - LABEL_CLEARANCE

/** Points along a relationship's line (straight or quadratic) every few px. */
function sampleLine(rel: PositionedC4Relationship): Point[] {
  const start = rel.points[0]!
  const end = rel.points[rel.points.length - 1]!
  const c = rel.curve
  const len = Math.hypot(end.x - start.x, end.y - start.y)
  const n = Math.max(1, Math.ceil(len / LINE_SAMPLE))
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    if (!c) {
      return {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      }
    }
    const u = 1 - t
    return {
      x: u * u * start.x + 2 * u * t * c.x + t * t * end.x,
      y: u * u * start.y + 2 * u * t * c.y + t * t * end.y,
    }
  })
}

/** The frame lines and heading texts of the boundaries, which a label keeps off. */
function boundaryObstacles(boundaries: LaidOutBoundary[]): Obstacle[] {
  return boundaries.flatMap((b) => {
    // Padded, so a label sits clear of a dashed line or a heading, not on it.
    const frame = (
      x0: number,
      x1: number,
      y0: number,
      y1: number,
      pad: number,
    ) => ({
      x0: x0 - pad,
      x1: x1 + pad,
      y0: y0 - pad,
      y1: y1 + pad,
      weight: FRAME_WEIGHT,
    })
    const text = (label: string, y: number, size: number, weight: number) => {
      const w = c4TextWidth(label, size, weight)
      const cx = b.x + b.width / 2
      return frame(
        cx - w / 2,
        cx + w / 2,
        b.y + y - size / 2,
        b.y + y + size / 2,
        HEADING_PAD,
      )
    }
    const typeLine = c4BoundaryTypeLine({
      ...b,
      elementAliases: [],
      children: [],
    })
    return [
      frame(b.x, b.x + b.width, b.y, b.y, FRAME_PAD), // top
      frame(b.x, b.x + b.width, b.y + b.height, b.y + b.height, FRAME_PAD), // bottom
      frame(b.x, b.x, b.y, b.y + b.height, FRAME_PAD), // left
      frame(b.x + b.width, b.x + b.width, b.y, b.y + b.height, FRAME_PAD), // right
      text(b.label, b.labelY, C4.boundarySize + 2, 700),
      ...(typeLine ? [text(typeLine, b.typeY!, C4.boundarySize, 400)] : []),
      ...(b.description
        ? [text(b.description, b.descrY!, C4.boundarySize - 2, 400)]
        : []),
    ]
  })
}

/** One way to set a label: its text lines, and where they are centred. */
interface LabelVariant {
  lines: string[]
  position: Point
  technologyX?: number
}

/** The rectangles a label's lines occupy when set as `variant`. */
function labelRects(
  rel: PositionedC4Relationship,
  variant: LabelVariant,
): Rect[] {
  return c4RelLabelBoxes({
    ...rel,
    labelLines: variant.lines,
    labelPosition: variant.position,
    ...(variant.technologyX === undefined
      ? {}
      : { technologyX: variant.technologyX }),
  }).map(rectOf)
}

/**
 * Mermaid starts a label at the chord's midpoint, so a label can land on a
 * shape the line passes beside or through (#1290), and nothing stops it
 * landing on a boundary's frame or heading, or on another relationship
 * (#1908). Try the label in place, slid along the chord, set a little to
 * either side of it, and wrapped narrower; keep the trial that touches the
 * least (a shape counts most), breaking ties by the smallest move. The
 * renderer draws the label on a background plate, as flowchart edge labels
 * are, so a line that still runs under it does not strike the text through.
 */
function clearLabel(
  rel: PositionedC4Relationship,
  obstacles: Obstacle[],
  lines: Point[][],
  placed: Obstacle[],
): void {
  const start = rel.points[0]
  const end = rel.points[rel.points.length - 1]
  const origin = rel.labelPosition
  if (!origin || !start || !end) return
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len = Math.hypot(dx, dy)
  const own = c4RelLabelLines(rel)
  const hasHead = rel.label !== '' || rel.index !== undefined
  const headWidth = hasHead ? c4TextWidth(own[0]!, C4.messageSize, 400) : 0
  const midX = origin.x - headWidth / 2

  const variants: { variant: LabelVariant; cost: number }[] = [
    {
      variant: {
        lines: own,
        position: origin,
        ...(rel.technologyX === undefined
          ? {}
          : { technologyX: rel.technologyX }),
      },
      cost: 0,
    },
  ]
  if (hasHead) {
    const tail = rel.technology ? [`[${rel.technology}]`] : []
    const seen = new Set([own.join('\n')])
    WRAP_FRACTIONS.forEach((fraction, i) => {
      const head = wrapToWidth(own[0]!, headWidth * fraction, C4.messageSize)
      const key = [...head, ...tail].join('\n')
      if (seen.has(key)) return
      seen.add(key)
      const widest = Math.max(
        ...head.map((l) => c4TextWidth(l, C4.messageSize, 400)),
      )
      variants.push({
        variant: {
          lines: [...head, ...tail],
          position: { x: midX + widest / 2, y: origin.y },
        },
        cost: 25 * (i + 1),
      })
    })
  }

  const ux = len === 0 ? 0 : dx / len
  const uy = len === 0 ? 0 : dy / len
  // Only what lies within reach of a trial can be touched by one: the labels'
  // boxes in place, moved at most half the chord along it and the widest side
  // step off it.
  const reach = len / 2 + Math.max(...SIDE_STEPS) + LABEL_CLEARANCE
  const spots = variants.flatMap((v) => labelRects(rel, v.variant))
  const region: Rect = {
    x0: Math.min(...spots.map((r) => r.x0)) - reach,
    x1: Math.max(...spots.map((r) => r.x1)) + reach,
    y0: Math.min(...spots.map((r) => r.y0)) - reach,
    y1: Math.max(...spots.map((r) => r.y1)) + reach,
  }
  const inReach = (r: Rect): boolean =>
    r.x0 < region.x1 && r.x1 > region.x0 && r.y0 < region.y1 && r.y1 > region.y0
  const all = [...obstacles, ...placed].filter(inReach)
  // At most about 100 trial positions along a long chord, so cost stays bounded.
  const step = Math.max(LABEL_STEP, len / 200)
  // A line can only touch a label inside its bounds, so most are skipped
  // without scanning their points.
  const nearLines = lines.filter((pts) =>
    inReach({
      x0: Math.min(...pts.map((p) => p.x)),
      x1: Math.max(...pts.map((p) => p.x)),
      y0: Math.min(...pts.map((p) => p.y)),
      y1: Math.max(...pts.map((p) => p.y)),
    }),
  )
  const lineBounds = nearLines.map((pts) => ({
    x0: Math.min(...pts.map((p) => p.x)),
    x1: Math.max(...pts.map((p) => p.x)),
    y0: Math.min(...pts.map((p) => p.y)),
    y1: Math.max(...pts.map((p) => p.y)),
  }))
  let best:
    { v: LabelVariant; at: Point; penalty: number; cost: number } | undefined
  // Once a trial touches nothing, only a cheaper one can beat it.
  const settled = (cost: number): boolean =>
    best?.penalty === 0 && cost >= best.cost
  for (const { variant, cost: base } of variants) {
    // The label's boxes in place; a trial only shifts them.
    const baseBoxes = labelRects(rel, variant)
    for (const side of SIDE_STEPS) {
      if (settled(base + 2 * Math.abs(side))) continue
      for (let t = 0; t <= len / 2; t += step) {
        if (settled(base + 2 * Math.abs(side) + t)) break
        for (const s of t === 0 ? [1] : [1, -1]) {
          const along = s * t
          const at = {
            x: along * ux - side * uy,
            y: along * uy + side * ux,
          }
          const boxes = baseBoxes.map((r) => ({
            x0: r.x0 + at.x,
            x1: r.x1 + at.x,
            y0: r.y0 + at.y,
            y1: r.y1 + at.y,
          }))
          let penalty = 0
          // Past the best penalty so far a trial cannot win: stop counting.
          const limit = best?.penalty ?? Infinity
          for (const b of boxes) {
            if (penalty > limit) break
            for (const o of all) {
              if (rectsOverlap(b, o)) penalty += o.weight
              if (penalty > limit) break
            }
            if (penalty > limit) break
            for (const [i, pts] of nearLines.entries()) {
              const lb = lineBounds[i]!
              if (
                lb.x1 <= b.x0 ||
                lb.x0 >= b.x1 ||
                lb.y1 <= b.y0 ||
                lb.y0 >= b.y1
              ) {
                continue
              }
              if (
                pts.some(
                  (p) => p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1,
                )
              ) {
                penalty += LINE_WEIGHT
              }
            }
          }
          const cost = base + t + 2 * Math.abs(side)
          if (
            !best ||
            penalty < best.penalty ||
            (penalty === best.penalty && cost < best.cost)
          ) {
            best = { v: variant, at, penalty, cost }
          }
        }
      }
    }
  }
  const { v, at } = best!
  rel.labelPosition = { x: v.position.x + at.x, y: v.position.y + at.y }
  if (v.lines !== own) rel.labelLines = v.lines
  if (v.technologyX === undefined) delete rel.technologyX
  else rel.technologyX = v.technologyX + at.x
  placed.push(
    ...c4RelLabelBoxes(rel).map((b) => ({
      ...rectOf(b),
      weight: FRAME_WEIGHT,
    })),
  )
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
  const obstacles: Obstacle[] = [
    ...elements.map((e) => ({
      // Padded so a label also keeps off the arrowhead that ends a line on it.
      x0: e.x - SHAPE_CLEARANCE,
      x1: e.x + e.width + SHAPE_CLEARANCE,
      y0: e.y - SHAPE_CLEARANCE,
      y1: e.y + e.height + SHAPE_CLEARANCE,
      weight: SHAPE_WEIGHT,
    })),
    ...boundaryObstacles(boundaries),
  ]
  const sampled = relationships.map(sampleLine)
  const placedLabels: Obstacle[] = []
  relationships.forEach((r, i) =>
    clearLabel(
      r,
      obstacles,
      sampled.filter((_, j) => j !== i),
      placedLabels,
    ),
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
