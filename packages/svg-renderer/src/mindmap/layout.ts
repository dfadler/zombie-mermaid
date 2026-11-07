// ============================================================================
// Mindmap layout
//
// Turns a parsed Mindmap into absolute SVG geometry, following Mermaid 12.3.0
// (packages/mermaid/src/diagrams/mindmap and rendering-util):
//
//   - labels are Markdown, at most 200px wide (`maxNodeWidth`): a label whose
//     longest line reaches 200px wraps at word breaks into a 200px box, any
//     other is as wide as its longest line; 24px per line (line-height 1.5)
//   - node padding `p` = 10 (`mindmap.padding`), half of it `hp` = 5:
//       default   (bw + 8hp) x (bh + 2hp), rounded top and bottom, underline
//       rect      (bw + 40) x (bh + 20)
//       rounded   (bw + 30) x (bh + 30), 5px corners
//       circle    radius = hypot(bw, bh) / 2 + 10
//       hexagon   h = bh + 20, point inset h / 4, w = bw + h / 2 + 20
//       cloud     (bw + 10) x (bh + 10) path of arcs
//       bang      (bw + 50) x (bh + 40) path of arcs
//   - positions come from cytoscape's CoSE-Bilkent force layout (quality
//     "proof"), ported in ./cose-bilkent.ts; it is deterministic
//   - an edge is a basis spline through three points: the parent's centre
//     moved 15px toward the child, the midpoint, and the child's centre moved
//     15px back (cytoscape's default 30px node), both ends hidden under the
//     nodes
//   - the first-level branches take colour sections 0..10 in turn, deeper
//     nodes inherit; an edge is `17 - 3 * (depth + 1)` thick, depth being its
//     parent's indentation level plus one (3 once that is not positive, as
//     CSS drops the rule)
//   - the viewBox is the node bounds plus `mindmap.padding` all round
//
// Text widths come from this library's own metrics for its own font, not
// Mermaid's "trebuchet ms", so sizes (and, because the layout is a physics
// simulation, positions) differ slightly from Mermaid's.
// ============================================================================

import type {
  Mindmap,
  MindmapNode,
  MindmapShape,
  MindmapTextRun,
  PositionedMindmap,
  PositionedMindmapEdge,
  PositionedMindmapNode,
} from '@zombie-mermaid/mermaid-parser'
import { mindmapLabelLines } from '@zombie-mermaid/mermaid-parser'
import { estimateTextWidth } from '../styles.ts'
import { coseBilkentLayout } from './cose-bilkent.ts'

/** Mermaid's mindmap defaults. */
export const MINDMAP = {
  padding: 10,
  maxNodeWidth: 200,
  fontSize: 16,
  lineHeight: 24,
  /** Section colours cycle through 0..sections-1 across the root's children. */
  sections: 11,
  /** Cytoscape's default node size: edges stop this far from a centre. */
  edgeInset: 15,
  cornerRadius: 5,
} as const

const num = (n: number): string => String(Math.round(n * 1e4) / 1e4)

function runWidth(run: MindmapTextRun): number {
  return estimateTextWidth(run.text, MINDMAP.fontSize, run.bold ? 700 : 400)
}

function lineWidth(line: readonly MindmapTextRun[]): number {
  return line.reduce((sum, run) => sum + runWidth(run), 0)
}

/** Greedy word wrap of one line of runs into `max` px lines; a word split across styled runs stays whole. */
function wrapLine(
  line: readonly MindmapTextRun[],
  max: number,
): MindmapTextRun[][] {
  const tokens = line.flatMap((run) =>
    (run.text.match(/\s+|\S+/g) ?? []).map((text) => ({ ...run, text })),
  )
  const isSpace = (t: MindmapTextRun) => /^\s/.test(t.text)
  const out: MindmapTextRun[][] = [[]]
  let width = 0
  for (let i = 0; i < tokens.length;) {
    if (isSpace(tokens[i]!)) {
      out[out.length - 1]!.push(tokens[i]!)
      width += runWidth(tokens[i]!)
      i++
      continue
    }
    const word: MindmapTextRun[] = []
    while (i < tokens.length && !isSpace(tokens[i]!)) word.push(tokens[i++]!)
    const w = lineWidth(word)
    const current = out[out.length - 1]!
    if (width + w > max && current.some((t) => !isSpace(t))) {
      out.push([])
      width = 0
    }
    out[out.length - 1]!.push(...word)
    width += w
  }
  return out
}

/** Label lines and box: wrap at 200px when the longest line reaches it. */
export function layoutLabel(text: string): {
  lines: MindmapTextRun[][]
  width: number
  height: number
} {
  const natural = mindmapLabelLines(text)
  const widest = Math.max(...natural.map(lineWidth))
  if (widest < MINDMAP.maxNodeWidth) {
    return {
      lines: natural,
      width: widest,
      height: natural.length * MINDMAP.lineHeight,
    }
  }
  const lines = natural.flatMap((line) => wrapLine(line, MINDMAP.maxNodeWidth))
  return {
    lines,
    width: MINDMAP.maxNodeWidth,
    height: lines.length * MINDMAP.lineHeight,
  }
}

// ---- cloud and bang paths ---------------------------------------------------

interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** `a rx,ry rot large,sweep dx,dy` extremes, from the SVG spec's centre form. */
function arcExtent(
  x1: number,
  y1: number,
  rx0: number,
  ry0: number,
  rotDeg: number,
  large: number,
  sweep: number,
  x2: number,
  y2: number,
  box: Box,
): void {
  const grow = (x: number, y: number) => {
    box.minX = Math.min(box.minX, x)
    box.maxX = Math.max(box.maxX, x)
    box.minY = Math.min(box.minY, y)
    box.maxY = Math.max(box.maxY, y)
  }
  grow(x2, y2)
  let rx = Math.abs(rx0)
  let ry = Math.abs(ry0)
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return
  const phi = (rotDeg * Math.PI) / 180
  const cos = Math.cos(phi)
  const sin = Math.sin(phi)
  const dx = (x1 - x2) / 2
  const dy = (y1 - y2) / 2
  const x1p = cos * dx + sin * dy
  const y1p = -sin * dx + cos * dy
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
  if (lambda > 1) {
    const s = Math.sqrt(lambda)
    rx *= s
    ry *= s
  }
  const num1 = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num1 / den))
  const cxp = (coef * rx * y1p) / ry
  const cyp = (-coef * ry * x1p) / rx
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
    return a
  }
  const theta1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
  let delta = ang(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry,
  )
  if (!sweep && delta > 0) delta -= 2 * Math.PI
  else if (sweep && delta < 0) delta += 2 * Math.PI
  // Candidate extremes of x(t) and y(t): where their derivatives vanish.
  const tx = Math.atan2(-ry * sin, rx * cos)
  const ty = Math.atan2(ry * cos, rx * sin)
  for (const base of [tx, tx + Math.PI, ty, ty + Math.PI]) {
    // Bring the candidate into the swept range, if it is in it.
    let t = base
    const lo = Math.min(theta1, theta1 + delta)
    const hi = Math.max(theta1, theta1 + delta)
    while (t < lo) t += 2 * Math.PI
    while (t - 2 * Math.PI >= lo) t -= 2 * Math.PI
    if (t > hi) continue
    grow(
      cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin,
      cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos,
    )
  }
}

/** Bounding box of `M0 0` followed by relative arcs, as `getBBox()` reports it. */
function arcPathBox(arcs: readonly number[][]): Box {
  const box: Box = { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  let x = 0
  let y = 0
  for (const [rx, ry, rot, large, sweep, dx, dy] of arcs as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ][]) {
    arcExtent(x, y, rx, ry, rot, large, sweep, x + dx, y + dy, box)
    x += dx
    y += dy
  }
  return box
}

function arcPathD(arcs: readonly number[][]): string {
  return (
    'M0 0 ' +
    arcs
      .map((a) => `a${a[0]},${a[1]} ${a[2]} ${a[3]},${a[4]} ${a[5]},${a[6]}`)
      .join(' ') +
    ' H0 V0 Z'
  )
}

function cloudArcs(w: number, h: number): number[][] {
  const r1 = 0.15 * w
  const r2 = 0.25 * w
  const r3 = 0.35 * w
  const r4 = 0.2 * w
  return [
    [r1, r1, 0, 0, 1, w * 0.25, -w * 0.1],
    [r3, r3, 1, 0, 1, w * 0.4, -w * 0.1],
    [r2, r2, 1, 0, 1, w * 0.35, w * 0.2],
    [r1, r1, 1, 0, 1, w * 0.15, h * 0.35],
    [r4, r4, 1, 0, 1, -w * 0.15, h * 0.65],
    [r2, r1, 1, 0, 1, -w * 0.25, w * 0.15],
    [r3, r3, 1, 0, 1, -w * 0.5, 0],
    [r1, r1, 1, 0, 1, -w * 0.25, -w * 0.15],
    [r1, r1, 1, 0, 1, -w * 0.1, -h * 0.35],
    [r4, r4, 1, 0, 1, w * 0.1, -h * 0.65],
  ]
}

function bangArcs(w: number, h: number): number[][] {
  const r = 0.15 * w
  const r8 = r * 0.8
  return [
    [r, r, 1, 0, 0, w * 0.25, -h * 0.1],
    [r, r, 1, 0, 0, w * 0.25, 0],
    [r, r, 1, 0, 0, w * 0.25, 0],
    [r, r, 1, 0, 0, w * 0.25, h * 0.1],
    [r, r, 1, 0, 0, w * 0.15, h * 0.33],
    [r8, r8, 1, 0, 0, 0, h * 0.34],
    [r, r, 1, 0, 0, -w * 0.15, h * 0.33],
    [r, r, 1, 0, 0, -w * 0.25, h * 0.15],
    [r, r, 1, 0, 0, -w * 0.25, 0],
    [r, r, 1, 0, 0, -w * 0.25, 0],
    [r, r, 1, 0, 0, -w * 0.25, -h * 0.15],
    [r, r, 1, 0, 0, -w * 0.1, -h * 0.33],
    [r8, r8, 1, 0, 0, 0, -h * 0.34],
    [r, r, 1, 0, 0, w * 0.1, -h * 0.33],
  ]
}

// ---- shapes -------------------------------------------------------------------

interface Shape {
  width: number
  height: number
  /** Top-left of the drawn box relative to the node position. */
  boxX: number
  boxY: number
  path?: string
  points?: string
  radius?: number
  rect?: { width: number; height: number; radius: number }
  underline?: boolean
}

export function shapeFor(shape: MindmapShape, bw: number, bh: number): Shape {
  const p = MINDMAP.padding
  const hp = p / 2
  switch (shape) {
    case 'circle': {
      const radius = Math.hypot(bw, bh) / 2 + p
      return {
        width: 2 * radius,
        height: 2 * radius,
        boxX: -radius,
        boxY: -radius,
        radius,
      }
    }
    case 'rect': {
      const width = bw + 4 * p
      const height = bh + 2 * p
      return {
        width,
        height,
        boxX: -width / 2,
        boxY: -height / 2,
        rect: { width, height, radius: 0 },
      }
    }
    case 'rounded': {
      const width = bw + 3 * p
      const height = bh + 3 * p
      return {
        width,
        height,
        boxX: -width / 2,
        boxY: -height / 2,
        rect: { width, height, radius: MINDMAP.cornerRadius },
      }
    }
    case 'hexagon': {
      const h = bh + 2 * p
      const m = h / 4
      const w = bw + 2 * m + 2 * p
      return {
        width: w,
        height: h,
        boxX: -w / 2,
        boxY: -h / 2,
        points: [
          [m, 0],
          [w - m, 0],
          [w, -h / 2],
          [w - m, -h],
          [m, -h],
          [0, -h / 2],
        ]
          .map(([x, y]) => `${num(x! - w / 2)},${num(y! + h / 2)}`)
          .join(' '),
      }
    }
    case 'cloud': {
      const w = bw + 2 * hp
      const h = bh + 2 * hp
      const arcs = cloudArcs(w, h)
      const box = arcPathBox(arcs)
      return {
        width: box.maxX - box.minX,
        height: box.maxY - box.minY,
        boxX: -w / 2 + box.minX,
        boxY: -h / 2 + box.minY,
        path: translatePath(arcs, -w / 2, -h / 2),
      }
    }
    case 'bang': {
      const w0 = bw + 10 * hp
      const h0 = bh + 8 * hp
      const w = Math.max(w0, bw + 20)
      const h = Math.max(h0, bh + 20)
      const arcs = bangArcs(w, h)
      const box = arcPathBox(arcs)
      return {
        width: box.maxX - box.minX,
        height: box.maxY - box.minY,
        boxX: -w / 2 + box.minX,
        boxY: -h / 2 + box.minY,
        path: translatePath(arcs, -w / 2, -h / 2),
      }
    }
    default: {
      const rd = MINDMAP.cornerRadius
      const w = bw + 8 * hp
      const h = bh + 2 * hp
      return {
        width: w,
        height: h,
        boxX: -w / 2,
        boxY: -h / 2,
        underline: true,
        path:
          `M${num(-w / 2)} ${num(h / 2 - rd)} v${num(-h + 2 * rd)} q0,${-rd} ${rd},${-rd} ` +
          `h${num(w - 2 * rd)} q${rd},0 ${rd},${rd} v${num(h - 2 * rd)} ` +
          `q0,${rd} ${-rd},${rd} h${num(-(w - 2 * rd))} q${-rd},0 ${-rd},${-rd} Z`,
      }
    }
  }
}

/** The arc path moved so its origin sits at (dx, dy) from the node centre. */
function translatePath(
  arcs: readonly number[][],
  dx: number,
  dy: number,
): string {
  return arcPathD(arcs).replace('M0 0', `M${num(dx)} ${num(dy)}`)
}

// ---- layout ----------------------------------------------------------------------

/** The basis spline d3 draws through `pts`, as Mermaid's `curve: 'basis'` does. */
export function basisPath(pts: readonly [number, number][]): string {
  const f = (v: number) => num(v)
  const [p0, p1, p2] = pts as [
    [number, number],
    [number, number],
    [number, number],
  ]
  const at = (a: number[], b: number[], ka: number, kb: number, k: number) =>
    `${f((ka * a[0]! + kb * b[0]!) / k)},${f((ka * a[1]! + kb * b[1]!) / k)}`
  const mix3 = (a: number[], b: number[], c: number[]) =>
    `${f((a[0]! + 4 * b[0]! + c[0]!) / 6)},${f((a[1]! + 4 * b[1]! + c[1]!) / 6)}`
  return (
    `M${f(p0[0])},${f(p0[1])}` +
    `L${at(p0, p1, 5, 1, 6)}` +
    `C${at(p0, p1, 2, 1, 3)},${at(p0, p1, 1, 2, 3)},${mix3(p0, p1, p2)}` +
    `C${at(p1, p2, 2, 1, 3)},${at(p1, p2, 1, 2, 3)},${at(p1, p2, 1, 5, 6)}` +
    `L${f(p2[0])},${f(p2[1])}`
  )
}

/** Lay out a parsed mindmap. */
export function layoutMindmap(mindmap: Mindmap): PositionedMindmap {
  const flat: MindmapNode[] = []
  const section = new Map<number, number | undefined>()
  const walk = (node: MindmapNode, sec: number | undefined) => {
    flat.push(node)
    section.set(node.id, sec)
    node.children.forEach((child, index) =>
      walk(child, node.level === 0 ? index % MINDMAP.sections : sec),
    )
  }
  walk(mindmap.root, undefined)

  const nodes: PositionedMindmapNode[] = flat.map((node) => {
    const label = layoutLabel(node.text)
    const shape = shapeFor(node.shape, label.width, label.height)
    return {
      node,
      section: section.get(node.id),
      x: 0,
      y: 0,
      width: shape.width,
      height: shape.height,
      boxX: shape.boxX,
      boxY: shape.boxY,
      lines: label.lines,
      labelWidth: label.width,
      labelHeight: label.height,
      ...(shape.path === undefined ? {} : { path: shape.path }),
      ...(shape.points === undefined ? {} : { points: shape.points }),
      ...(shape.radius === undefined ? {} : { radius: shape.radius }),
      ...(shape.rect === undefined ? {} : { rect: shape.rect }),
      ...(shape.underline ? { underline: true } : {}),
    }
  })

  const positions = coseBilkentLayout(
    nodes.map((n) => ({
      id: String(n.node.id),
      width: n.width,
      height: n.height,
    })),
    flat.flatMap((node) =>
      node.children.map((child) => ({
        source: String(node.id),
        target: String(child.id),
      })),
    ),
  )
  for (const n of nodes) {
    const at = positions.get(String(n.node.id))!
    n.x = at.x
    n.y = at.y
  }

  const edges: PositionedMindmapEdge[] = []
  for (const parent of nodes) {
    for (const child of parent.node.children) {
      const c = nodes[child.id]!
      const dx = c.x - parent.x
      const dy = c.y - parent.y
      const len = Math.hypot(dx, dy) || 1
      const inset = MINDMAP.edgeInset
      const a: [number, number] = [
        parent.x + (dx / len) * inset,
        parent.y + (dy / len) * inset,
      ]
      const b: [number, number] = [
        c.x - (dx / len) * inset,
        c.y - (dy / len) * inset,
      ]
      edges.push({
        from: parent.node.id,
        to: child.id,
        section: c.section,
        depth: parent.node.level + 1,
        path: basisPath([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b]),
      })
    }
  }

  // Bounds of the drawn nodes.
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x + n.boxX)
    minY = Math.min(minY, n.y + n.boxY)
    maxX = Math.max(maxX, n.x + n.boxX + n.width)
    maxY = Math.max(maxY, n.y + n.boxY + n.height)
  }
  const pad = MINDMAP.padding
  return {
    originX: minX - pad,
    originY: minY - pad,
    width: maxX - minX + 2 * pad,
    height: maxY - minY + 2 * pad,
    nodes,
    edges,
  }
}
