// ============================================================================
// Block diagram shapes
//
// A port of the shape functions Mermaid 12.3.0 draws block nodes with
// (packages/mermaid/src/rendering-util/rendering-elements/shapes/*.ts: circle,
// doublecircle, question, hexagon, stadium, subroutine, cylinder,
// rectLeftInvArrow, leanLeft, leanRight, trapezoid, invTrapezoid, blockArrow,
// and the intersect functions in ../intersect/), classic look.
//
// Mermaid sizes a block twice. The first pass draws the node on its own and
// takes the bounding box of what it drew as the block's size (`fitShape` with
// no `cell`); the grid is laid out from those sizes. The second pass draws the
// node again knowing the size of its cell (`fitShape` with `cell`): the polygon
// shapes, the cylinder and the double circle then grow to the cell, while the
// circle, diamond, stadium and block arrow keep their own size and sit in the
// middle of it. A shape's bounding box is what edges clip against.
// ============================================================================

import type { BlockGeometry, BlockShape } from '@zombie-mermaid/mermaid-parser'

/** A geometry before its drawn extent is known. */
type Draft = Omit<BlockGeometry, 'extent'>

interface Pt {
  x: number
  y: number
}

export interface Cell {
  width: number
  height: number
  /** How many columns the block spans (a block arrow stretches only when it spans more than one). */
  span: number
}

/** What `fitShape` returns: the drawing and the size the block takes in the grid. */
export interface ShapeFit {
  geometry: BlockGeometry
  /** Size of the node's bounding box: the shape together with its label. */
  width: number
  height: number
}

const bboxOf = (pts: Pt[]) => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { minX, minY, maxX, maxY }
}

/**
 * A polygon shape: `points` in the shape's own coordinates, drawn with the
 * translation Mermaid's `insertPolygonShape` gives them (`tx`, `ty`).
 */
function polygon(
  points: Pt[],
  tx: number,
  ty: number,
  labelDx = 0,
  labelDy = 0,
): Draft {
  const local = bboxOf(points)
  return {
    kind: 'polygon',
    points: points.map((p) => ({ x: p.x + tx, y: p.y + ty })),
    clip: {
      width: local.maxX - local.minX,
      height: local.maxY - local.minY,
      points,
    },
    labelDx,
    labelDy,
  }
}

/** `insertPolygonShape(parent, w, h, points)`: centred on `w` x `h`. */
const centred = (points: Pt[], w: number, h: number): Draft =>
  polygon(points, -w / 2, h / 2)

const STADIUM_ARC_POINTS = 50

/** Mermaid's `generateCirclePoints` (it negates both coordinates). */
function arc(
  cx: number,
  cy: number,
  radius: number,
  from: number,
  to: number,
): Pt[] {
  const a0 = (from * Math.PI) / 180
  const step = ((to * Math.PI) / 180 - a0) / (STADIUM_ARC_POINTS - 1)
  return Array.from({ length: STADIUM_ARC_POINTS }, (_, i) => ({
    x: -(cx + radius * Math.cos(a0 + i * step)),
    y: -(cy + radius * Math.sin(a0 + i * step)),
  }))
}

const DIRECTION_ORDER = ['right', 'left', 'up', 'down']

/** Mermaid's `arrowPointFactories`, keyed by the directions present (in `DIRECTION_ORDER`). */
function arrowPoints(
  directions: string[],
  height: number,
  midpoint: number,
  padding: number,
  width: number,
): Pt[] {
  const set = new Set<string>()
  for (const d of directions) {
    if (d === 'x') {
      set.add('right')
      set.add('left')
    } else if (d === 'y') {
      set.add('up')
      set.add('down')
    } else set.add(d)
  }
  const key = DIRECTION_ORDER.filter((d) => set.has(d)).join('|')
  const h = height
  const m = midpoint
  const w = width
  const p = padding
  const P = (x: number, y: number): Pt => ({ x, y })
  switch (key) {
    case 'right|left|up|down':
      return [
        P(0, 0),
        P(m, 0),
        P(w / 2, 2 * p),
        P(w - m, 0),
        P(w, 0),
        P(w, -h / 3),
        P(w + 2 * p, -h / 2),
        P(w, (-2 * h) / 3),
        P(w, -h),
        P(w - m, -h),
        P(w / 2, -h - 2 * p),
        P(m, -h),
        P(0, -h),
        P(0, (-2 * h) / 3),
        P(-2 * p, -h / 2),
        P(0, -h / 3),
      ]
    case 'right|left|up':
      return [
        P(m, 0),
        P(w - m, 0),
        P(w, -h / 2),
        P(w - m, -h),
        P(m, -h),
        P(0, -h / 2),
      ]
    case 'right|left|down':
      return [P(0, 0), P(m, -h), P(w - m, -h), P(w, 0)]
    case 'right|up|down':
      return [P(0, 0), P(w, -m), P(w, -h + m), P(0, -h)]
    case 'left|up|down':
      return [P(w, 0), P(0, -m), P(0, -h + m), P(w, -h)]
    case 'right|left':
      return [
        P(m, 0),
        P(m, -p),
        P(w - m, -p),
        P(w - m, 0),
        P(w, -h / 2),
        P(w - m, -h),
        P(w - m, -h + p),
        P(m, -h + p),
        P(m, -h),
        P(0, -h / 2),
      ]
    case 'up|down':
      return [
        P(w / 2, 0),
        P(0, -p),
        P(m, -p),
        P(m, -h + p),
        P(0, -h + p),
        P(w / 2, -h),
        P(w, -h + p),
        P(w - m, -h + p),
        P(w - m, -p),
        P(w, -p),
      ]
    case 'right|up':
      return [P(0, 0), P(w, -m), P(0, -h)]
    case 'right|down':
      return [P(0, 0), P(w, 0), P(0, -h)]
    case 'left|up':
      return [P(w, 0), P(0, -m), P(w, -h)]
    case 'left|down':
      return [P(w, 0), P(0, 0), P(w, -h)]
    case 'right':
      return [
        P(m, -p),
        P(m, -p),
        P(w - m, -p),
        P(w - m, 0),
        P(w, -h / 2),
        P(w - m, -h),
        P(w - m, -h + p),
        P(m, -h + p),
        P(m, -h + p),
      ]
    case 'left':
      return [
        P(m, 0),
        P(m, -p),
        P(w - m, -p),
        P(w - m, -h + p),
        P(m, -h + p),
        P(m, -h),
        P(0, -h / 2),
      ]
    case 'up':
      return [
        P(m, -p),
        P(m, -h + p),
        P(0, -h + p),
        P(w / 2, -h),
        P(w, -h + p),
        P(w - m, -h + p),
        P(w - m, -p),
      ]
    case 'down':
      return [
        P(w / 2, 0),
        P(0, -p),
        P(m, -p),
        P(m, -h + p),
        P(w - m, -h + p),
        P(w - m, -p),
        P(w, -p),
      ]
    default:
      return [P(0, 0)]
  }
}

/**
 * Draw `shape` for a label `tw` wide and `lh` tall with the block's `padding`,
 * in the cell it was given (none on the first pass). `shape` is never `square`,
 * `round`, nor a group: those stay rectangles (see layout.ts).
 */
export function fitShape(
  shape: Exclude<BlockShape, 'square' | 'round'>,
  directions: string[],
  tw: number,
  lh: number,
  padding: number,
  cell?: Cell,
): ShapeFit {
  const p = padding
  let geometry: Draft
  switch (shape) {
    case 'circle': {
      const r = Math.hypot(tw, lh) / 2 + p / 2
      geometry = {
        kind: 'circle',
        r,
        clip: { width: 2 * r, height: 2 * r, r },
        labelDx: 0,
        labelDy: 0,
      }
      break
    }
    case 'doublecircle': {
      const inner = (cell ? cell.width / 2 : Math.hypot(tw, lh) / 2) + p
      const outer = inner + 5
      geometry = {
        kind: 'doublecircle',
        r: outer,
        inner,
        clip: { width: 2 * outer, height: 2 * outer, r: outer },
        labelDx: 0,
        labelDy: 0,
      }
      break
    }
    case 'diamond': {
      const s = tw + p + (lh + p)
      geometry = polygon(
        [
          { x: s / 2, y: 0 },
          { x: s, y: -s / 2 },
          { x: s / 2, y: -s },
          { x: 0, y: -s / 2 },
        ],
        -s / 2 + 0.5,
        s / 2,
      )
      break
    }
    case 'hexagon': {
      let width: number | undefined
      let height: number | undefined
      if (cell) {
        width = cell.width - 2 * (cell.height / 4) - p
        height = cell.height - p
      }
      const h = (height || lh) + p
      const m = h / 4
      const w = (width || tw) + 2 * m + p
      geometry = centred(
        [
          { x: m, y: 0 },
          { x: w - m, y: 0 },
          { x: w, y: -h / 2 },
          { x: w - m, y: -h },
          { x: m, y: -h },
          { x: 0, y: -h / 2 },
        ],
        w,
        h,
      )
      break
    }
    case 'stadium': {
      const h = lh + p
      const inscribed = h * Math.cos(Math.PI / (2 * (STADIUM_ARC_POINTS - 1)))
      const cap = Math.sqrt(Math.max(0, inscribed ** 2 - lh ** 2))
      const w = Math.max(
        tw + h / 4 + p,
        1.5 * h + (h - inscribed),
        tw + p + h - cap,
      )
      const r = h / 2
      geometry = polygon(
        [
          { x: -w / 2 + r, y: -h / 2 },
          { x: w / 2 - r, y: -h / 2 },
          ...arc(-w / 2 + r, 0, r, 90, 270),
          { x: w / 2 - r, y: h / 2 },
          ...arc(w / 2 - r, 0, r, 270, 450),
        ],
        0,
        0,
      )
      break
    }
    case 'subroutine': {
      const totalW = Math.max(tw + 16 + p, cell?.width ?? 0)
      const h = Math.max(lh + p, cell?.height ?? 0)
      const w = totalW - 16
      geometry = centred(
        [
          { x: 0, y: 0 },
          { x: w, y: 0 },
          { x: w, y: -h },
          { x: 0, y: -h },
          { x: 0, y: 0 },
          { x: -8, y: 0 },
          { x: w + 8, y: 0 },
          { x: w + 8, y: -h },
          { x: -8, y: -h },
          { x: -8, y: 0 },
        ],
        w,
        h,
      )
      break
    }
    case 'cylinder': {
      let nodeW: number | undefined
      let nodeH: number | undefined
      if (cell) {
        nodeW = Math.max(cell.width - p, 8)
        const ry2 = cell.width / 2 / (2.5 + cell.width / 50)
        nodeH = Math.max(cell.height - p - 3 * ry2, 8)
      }
      const w = Math.max(nodeW ?? 0, tw) + p
      const rx = w / 2
      const ry = rx / (2.5 + w / 50)
      const h = Math.max(nodeH ?? 0, lh) + p + ry
      const f = (n: number): string => String(Math.round(n * 1e6) / 1e6)
      geometry = {
        kind: 'cylinder',
        d: `M0,${f(ry)} a${f(rx)},${f(ry)} 0,0,0 ${f(w)},0 a${f(rx)},${f(ry)} 0,0,0 ${f(-w)},0 l0,${f(h)} a${f(rx)},${f(ry)} 0,0,0 ${f(w)},0 l0,${f(-h)}`,
        points: [
          { x: -w / 2, y: -(h / 2 + ry) },
          { x: w / 2, y: h / 2 + ry },
        ],
        clip: { width: w, height: h + 2 * ry, rx, ry },
        labelDx: 0,
        labelDy: p / 1.5,
      }
      break
    }
    case 'rect_left_inv_arrow': {
      const h = Math.max(lh + p, cell?.height ?? 0)
      const w = Math.max(tw + p, (cell?.width ?? 0) - h / 4)
      const x = -w / 2
      const y = -h / 2
      const notch = y / 2
      geometry = polygon(
        [
          { x: x + notch, y },
          { x, y: 0 },
          { x: x + notch, y: -y },
          { x: -x, y: -y },
          { x: -x, y },
        ],
        -notch / 2,
        0,
        -notch / 2,
      )
      break
    }
    case 'lean_right':
    case 'lean_left':
    case 'trapezoid':
    case 'inv_trapezoid': {
      const padY = shape === 'inv_trapezoid' ? 2 * p : p
      const padX = shape === 'inv_trapezoid' ? 2 * p : p
      const h = Math.max(lh + padY, cell?.height ?? 0)
      const w = Math.max(tw + padX, (cell?.width ?? 0) - h)
      const q = (3 * h) / 6
      const pts: Record<string, Pt[]> = {
        lean_right: [
          { x: -q, y: 0 },
          { x: w, y: 0 },
          { x: w + q, y: -h },
          { x: 0, y: -h },
        ],
        lean_left: [
          { x: 0, y: 0 },
          { x: w + q, y: 0 },
          { x: w, y: -h },
          { x: -q, y: -h },
        ],
        trapezoid: [
          { x: -q, y: 0 },
          { x: w + q, y: 0 },
          { x: w, y: -h },
          { x: 0, y: -h },
        ],
        inv_trapezoid: [
          { x: 0, y: 0 },
          { x: w, y: 0 },
          { x: w + q, y: -h },
          { x: -q, y: -h },
        ],
      }
      geometry = centred(pts[shape]!, w, h)
      break
    }
    case 'block_arrow': {
      const height = lh + 2 * p
      const midpoint = height / 2
      const natural = tw + 2 * midpoint + p
      const spanning =
        cell !== undefined && cell.span > 1 && cell.width > natural
      const width = spanning ? cell.width : natural
      geometry = centred(
        arrowPoints(directions, height, midpoint, p / 2, width),
        width,
        height,
      )
      break
    }
  }

  // The node's bounding box: its shape together with its label.
  const drawn =
    geometry.kind === 'circle' || geometry.kind === 'doublecircle'
      ? [
          { x: -geometry.r!, y: -geometry.r! },
          { x: geometry.r!, y: geometry.r! },
        ]
      : geometry.points!
  const box = bboxOf([
    ...drawn,
    { x: geometry.labelDx - tw / 2, y: geometry.labelDy - lh / 2 },
    { x: geometry.labelDx + tw / 2, y: geometry.labelDy + lh / 2 },
  ])
  return {
    geometry: { ...geometry, extent: bboxOf(drawn) },
    width: box.maxX - box.minX,
    height: box.maxY - box.minY,
  }
}

interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** Mermaid's `intersectRect`. */
export function intersectRect(n: Box, p: Pt): Pt {
  const dx = p.x - n.x
  const dy = p.y - n.y
  let w = n.width / 2
  let h = n.height / 2
  if (Math.abs(dy) * w > Math.abs(dx) * h) {
    if (dy < 0) h = -h
    return { x: n.x + (dy === 0 ? 0 : (h * dx) / dy), y: n.y + h }
  }
  if (dx < 0) w = -w
  return { x: n.x + w, y: n.y + (dx === 0 ? 0 : (w * dy) / dx) }
}

/** Mermaid's `intersectEllipse` (and `intersectCircle`). */
function intersectEllipse(n: Pt, rx: number, ry: number, p: Pt): Pt {
  const px = n.x - p.x
  const py = n.y - p.y
  const det = Math.sqrt(rx * rx * py * py + ry * ry * px * px)
  let dx = Math.abs((rx * ry * px) / det)
  if (p.x < n.x) dx = -dx
  let dy = Math.abs((rx * ry * py) / det)
  if (p.y < n.y) dy = -dy
  return { x: n.x + dx, y: n.y + dy }
}

function intersectLine(p1: Pt, p2: Pt, q1: Pt, q2: Pt): Pt | undefined {
  const a1 = p2.y - p1.y
  const b1 = p1.x - p2.x
  const c1 = p2.x * p1.y - p1.x * p2.y
  const r3 = a1 * q1.x + b1 * q1.y + c1
  const r4 = a1 * q2.x + b1 * q2.y + c1
  if (r3 !== 0 && r4 !== 0 && r3 * r4 > 0) return undefined
  const a2 = q2.y - q1.y
  const b2 = q1.x - q2.x
  const c2 = q2.x * q1.y - q1.x * q2.y
  const r1 = a2 * p1.x + b2 * p1.y + c2
  const r2 = a2 * p2.x + b2 * p2.y + c2
  if (Math.abs(r1) < 1e-6 && Math.abs(r2) < 1e-6 && r1 * r2 > 0)
    return undefined
  const denom = a1 * b2 - a2 * b1
  if (denom === 0) return undefined
  return { x: (b1 * c2 - b2 * c1) / denom, y: (a2 * c1 - a1 * c2) / denom }
}

/** Mermaid's `intersectPolygon`: where the line from the box centre to `p` first meets the polygon. */
function intersectPolygon(n: Box, poly: Pt[], p: Pt): Pt {
  let minX = Infinity
  let minY = Infinity
  for (const e of poly) {
    minX = Math.min(minX, e.x)
    minY = Math.min(minY, e.y)
  }
  const left = n.x - n.width / 2 - minX
  const top = n.y - n.height / 2 - minY
  const hits: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[i < poly.length - 1 ? i + 1 : 0]!
    const hit = intersectLine(
      n,
      p,
      { x: left + a.x, y: top + a.y },
      { x: left + b.x, y: top + b.y },
    )
    if (hit) hits.push(hit)
  }
  if (hits.length === 0) return n
  const dist = (q: Pt): number => Math.hypot(q.x - p.x, q.y - p.y)
  hits.sort((a, b) => dist(a) - dist(b))
  return hits[0]!
}

/** Where the line from the node centre (`cx`, `cy`) to `p` leaves the shape: the shape's own `intersect`. */
export function clipToShape(
  geometry: BlockGeometry,
  cx: number,
  cy: number,
  p: Pt,
): Pt {
  const { clip } = geometry
  const node = { x: cx, y: cy, width: clip.width, height: clip.height }
  if (clip.r !== undefined) return intersectEllipse(node, clip.r, clip.r, p)
  if (clip.points) return intersectPolygon(node, clip.points, p)
  // Cylinder: the rectangle's crossing, moved onto the rim of the top or bottom ellipse.
  const { rx = 0, ry = 0 } = clip
  const pos = intersectRect(node, p)
  const x = pos.x - cx
  if (
    rx !== 0 &&
    (Math.abs(x) < node.width / 2 ||
      (Math.abs(x) === node.width / 2 &&
        Math.abs(pos.y - cy) > node.height / 2 - ry))
  ) {
    let y = ry * ry * (1 - (x * x) / (rx * rx))
    if (y > 0) y = Math.sqrt(y)
    y = ry - y
    if (p.y - cy > 0) y = -y
    pos.y += y
  }
  return pos
}
