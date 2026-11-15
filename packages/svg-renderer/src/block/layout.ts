// ============================================================================
// Block diagram layout
//
// A port of Mermaid 12.3.0's block layout (packages/mermaid/src/diagrams/block/
// layout.ts and renderHelpers.ts), which is a grid, not a graph layout:
//
//   - a block is its label (one 24px line per `<br>`) plus 16px of padding
//     (32px across, 16px for a round block); `space` and groups have no size
//     of their own
//   - inside a group every child gets the size of the widest child (a child
//     spanning N columns counts as 1/N of its width) and the tallest height; a
//     child spanning N columns is N cells plus N - 1 paddings wide
//   - a group is `columns` cells wide (all children when `columns` is unset or
//     larger) and as many rows tall, with `padding` (8px) between cells and
//     around them; a group narrower than its parent's cell grows to it, and its
//     children are then re-divided to fill it
//   - cells are placed left to right, row by row, a block spanning more columns
//     than the row has left being clipped to what is left for the count only
//   - the drawing is the bounds of the drawn blocks, 5px of margin all round
//
// Text widths come from Trebuchet MS advances (Mermaid's default font).
// ============================================================================

import type {
  BlockDiagram,
  BlockEdge,
  BlockNode,
  PositionedBlockDiagram,
  PositionedBlockEdge,
  PositionedBlockNode,
} from '@zombie-mermaid/mermaid-parser'
import { textWidth } from '../timeline/layout.ts'

/** Mermaid's block defaults. */
export const BLOCK = {
  /** Space between cells and around a group's cells (`block.padding`). */
  padding: 8,
  lineHeight: 24,
  fontSize: 16,
  /** Margin of the viewBox around the drawn blocks. */
  margin: 5,
  cornerRadius: 5,
} as const

interface Size {
  width: number
  height: number
  x: number
  y: number
}

interface Cell {
  node: BlockNode
  size?: Size
  lines: string[]
  textW: number
  children: Cell[]
}

/** A label's lines: `<br>` breaks, whitespace collapsed as in an HTML label. */
function labelLines(label: string): string[] {
  return label.split(/<br\s*\/?>/i).map((l) => l.replace(/\s+/g, ' ').trim())
}

function toCell(node: BlockNode, padding: number): Cell {
  const lines = node.type === 'node' ? labelLines(node.label) : []
  const textW = Math.max(0, ...lines.map((l) => textWidth(l, BLOCK.fontSize)))
  const cell: Cell = {
    node,
    lines,
    textW,
    children: node.children.map((c) => toCell(c, padding)),
  }
  // Measured size of a plain block (`calculateBlockSize`); groups have none yet.
  if (node.type === 'node') {
    cell.size = {
      // A block is its label plus `padding` on each of its four sides, twice over across (2p for a round block).
      width: textW + (node.shape === 'round' ? 2 : 4) * padding,
      height: lines.length * BLOCK.lineHeight + 2 * padding,
      x: 0,
      y: 0,
    }
  }
  return cell
}

const span = (c: Cell): number => c.node.widthInColumns

function maxChildSize(cell: Cell): { width: number; height: number } {
  let width = 0
  let height = 0
  for (const child of cell.children) {
    if (child.node.type === 'space') continue
    const size = child.size ?? { width: 0, height: 0 }
    const normalized = size.width / span(child)
    if (normalized > width) width = normalized
    if (size.height > height) height = size.height
  }
  return { width, height }
}

/** Mermaid's `setBlockSizes`. */
function setBlockSizes(
  cell: Cell,
  siblingWidth = 0,
  siblingHeight = 0,
  padding: number = BLOCK.padding,
): void {
  if (!cell.size?.width) {
    cell.size = { width: siblingWidth, height: siblingHeight, x: 0, y: 0 }
  }
  if (cell.children.length === 0) return
  for (const child of cell.children) setBlockSizes(child, 0, 0, padding)
  const { width: maxWidth, height: maxHeight } = maxChildSize(cell)
  for (const child of cell.children) {
    if (!child.size) continue
    child.size.width = maxWidth * span(child) + padding * (span(child) - 1)
    child.size.height = maxHeight
    child.size.x = 0
    child.size.y = 0
  }
  for (const child of cell.children)
    setBlockSizes(child, maxWidth, maxHeight, padding)

  const columns = cell.node.columns ?? -1
  let numItems = 0
  for (const child of cell.children) numItems += span(child)
  let xSize = cell.children.length
  if (columns > 0 && columns < numItems) xSize = columns
  const ySize = Math.ceil(numItems / xSize)
  let width = xSize * (maxWidth + padding) + padding
  let height = ySize * (maxHeight + padding) + padding
  if (width < siblingWidth) {
    width = siblingWidth
    height = siblingHeight
    const childWidth = (siblingWidth - xSize * padding - padding) / xSize
    const childHeight = (siblingHeight - ySize * padding - padding) / ySize
    for (const child of cell.children) {
      if (!child.size) continue
      child.size.width = childWidth
      child.size.height = childHeight
      child.size.x = 0
      child.size.y = 0
    }
  }
  if (width < (cell.size?.width || 0)) {
    width = cell.size?.width || 0
    const num =
      columns > 0
        ? Math.min(cell.children.length, columns)
        : cell.children.length
    if (num > 0) {
      const childWidth = (width - num * padding - padding) / num
      for (const child of cell.children) {
        if (child.size) child.size.width = childWidth
      }
    }
  }
  cell.size = { width, height, x: 0, y: 0 }
}

/** Mermaid's `calculateBlockPosition`. */
function position(columns: number, pos: number): { px: number; py: number } {
  if (columns < 0) return { px: pos, py: 0 }
  if (columns === 1) return { px: 0, py: pos }
  return { px: pos % columns, py: Math.floor(pos / columns) }
}

/** Mermaid's `layoutBlocks`. */
function layoutBlocks(cell: Cell, padding: number = BLOCK.padding): void {
  const columns = cell.node.columns ?? -1
  if (cell.children.length === 0) return
  const parent = cell.size!

  const rowHeights = new Map<number, number>()
  let colPos = 0
  for (const child of cell.children) {
    if (!child.size) continue
    const { py } = position(columns, colPos)
    if (child.size.height > (rowHeights.get(py) ?? 0))
      rowHeights.set(py, child.size.height)
    let filled = span(child)
    if (columns > 0) filled = Math.min(filled, columns - (colPos % columns))
    colPos += filled
  }
  const rowYOffsets = new Map<number, number>()
  let offset = 0
  for (const row of [...rowHeights.keys()].sort((a, b) => a - b)) {
    rowYOffsets.set(row, offset)
    offset += (rowHeights.get(row) ?? 0) + padding
  }

  const left = () => (parent.x ? parent.x + (-parent.width / 2 || 0) : -padding)
  let columnPos = 0
  let startingPosX = left()
  let rowPos = 0
  for (const child of cell.children) {
    if (!child.size) continue
    const { width, height } = child.size
    const { py } = position(columns, columnPos)
    if (py !== rowPos) {
      rowPos = py
      startingPosX = left()
    }
    const halfWidth = width / 2
    child.size.x = startingPosX + padding + halfWidth
    startingPosX = child.size.x + halfWidth
    const rowHeight = rowHeights.get(py) ?? height
    child.size.y =
      parent.y -
      parent.height / 2 +
      (rowYOffsets.get(py) ?? 0) +
      rowHeight / 2 +
      padding
    layoutBlocks(child, padding)
    let filled = span(child)
    if (columns > 0) filled = Math.min(filled, columns - (columnPos % columns))
    columnPos += filled
  }
}

interface Pt {
  x: number
  y: number
}
interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** Mermaid's `intersectRect`: where the line from the box centre to `p` leaves the box. */
function intersectRect(n: Box, p: Pt): Pt {
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

/** Mermaid's `markerOffsets` for the arrow types a block edge can have. */
const markerOffset = (type: string): number | undefined =>
  type === 'arrow_point' ? 4 : undefined

/** Mermaid's `getLineFunctionsWithOffset`: pull the ends back so an arrow head touches the block. */
function withMarkerOffsets(data: Pt[], start: string, end: string): Pt[] {
  const sOff = markerOffset(start)
  const eOff = markerOffset(end)
  const last = data.length - 1
  const angle = (a: Pt, b: Pt) => Math.atan((b.y - a.y) / (b.x - a.x))
  const right = data[0]!.x < data[last]!.x
  const down = data[0]!.y < data[last]!.y
  return data.map((d, i) => {
    let ox = 0
    let oy = 0
    if (i === 0 && sOff !== undefined) {
      const a = angle(data[0]!, data[1]!)
      ox = sOff * Math.cos(a) * (data[1]!.x - data[0]!.x >= 0 ? 1 : -1)
      oy =
        sOff * Math.abs(Math.sin(a)) * (data[1]!.y - data[0]!.y >= 0 ? 1 : -1)
    } else if (i === last && eOff !== undefined) {
      const a = angle(data[last]!, data[last - 1]!)
      ox =
        eOff * Math.cos(a) * (data[last - 1]!.x - data[last]!.x >= 0 ? 1 : -1)
      oy =
        eOff *
        Math.abs(Math.sin(a)) *
        (data[last - 1]!.y - data[last]!.y >= 0 ? 1 : -1)
    }
    const toEndX = Math.abs(d.x - data[last]!.x)
    const toEndY = Math.abs(d.y - data[last]!.y)
    const toStartX = Math.abs(d.x - data[0]!.x)
    const toStartY = Math.abs(d.y - data[0]!.y)
    if (eOff !== undefined) {
      if (toEndX < eOff && toEndX > 0 && toEndY < eOff)
        ox -= (eOff + 1 - toEndX) * (right ? 1 : -1)
      if (toEndY < eOff && toEndY > 0 && toEndX < eOff)
        oy -= (eOff + 1 - toEndY) * (down ? 1 : -1)
    }
    if (sOff !== undefined) {
      if (toStartX < sOff && toStartX > 0 && toStartY < sOff)
        ox += (sOff + 1 - toStartX) * (right ? 1 : -1)
      if (toStartY < sOff && toStartY > 0 && toStartX < sOff)
        oy += (sOff + 1 - toStartY) * (down ? 1 : -1)
    }
    return { x: d.x + ox, y: d.y + oy }
  })
}

const f3 = (n: number): string => String(Math.round(n * 1000) / 1000)

/** D3's `curveBasis` path through three or more points (3 digits, as Mermaid prints it). */
function basisPath(p: Pt[]): string {
  let d = `M${f3(p[0]!.x)},${f3(p[0]!.y)}`
  d += `L${f3((5 * p[0]!.x + p[1]!.x) / 6)},${f3((5 * p[0]!.y + p[1]!.y) / 6)}`
  const bez = (a: Pt, b: Pt, c: Pt) =>
    `C${f3((2 * a.x + b.x) / 3)},${f3((2 * a.y + b.y) / 3)},${f3((a.x + 2 * b.x) / 3)},${f3((a.y + 2 * b.y) / 3)},${f3((a.x + 4 * b.x + c.x) / 6)},${f3((a.y + 4 * b.y + c.y) / 6)}`
  for (let i = 2; i < p.length; i++) d += bez(p[i - 2]!, p[i - 1]!, p[i]!)
  const a = p[p.length - 2]!
  const b = p[p.length - 1]!
  d += bez(a, b, b)
  return d + `L${f3(b.x)},${f3(b.y)}`
}

/** Mermaid's `insertEdges`: start centre, midpoint, end centre, clipped to the two blocks. */
function layoutEdges(
  edges: BlockEdge[],
  nodes: PositionedBlockNode[],
): PositionedBlockEdge[] {
  const byId = new Map<string, PositionedBlockNode>()
  for (const n of nodes) if (!byId.has(n.id)) byId.set(n.id, n)
  const out: PositionedBlockEdge[] = []
  for (const e of edges) {
    const a = byId.get(e.start)
    const b = byId.get(e.end)
    if (!a || !b) continue
    const mid = { x: a.x + (b.x - a.x) / 2, y: a.y + (b.y - a.y) / 2 }
    const points = [intersectRect(a, mid), mid, intersectRect(b, mid)]
    const path = basisPath(
      withMarkerOffsets(points, e.arrowTypeStart, e.arrowTypeEnd),
    )
    out.push({
      id: e.id,
      points,
      path,
      label: e.label,
      labelX: mid.x,
      labelY: mid.y,
      labelWidth: e.label
        ? textWidth(e.label.replace(/\s+/g, ' ').trim(), BLOCK.fontSize)
        : 0,
      thickness: e.thickness,
      pattern: e.pattern,
      arrowTypeStart: e.arrowTypeStart,
      arrowTypeEnd: e.arrowTypeEnd,
    })
  }
  return out
}

/**
 * Mermaid's `getStylesFromArray` over the node's `classDef` items (in the order
 * its classes were applied) and then its own `style` items: one value per
 * property, a later one replacing an earlier one in place.
 */
function compileStyles(
  classDefs: Record<string, string[]>,
  node: BlockNode,
): [string, string][] {
  const props = new Map<string, string>()
  const items = [
    ...node.classes.flatMap((c) => classDefs[c] ?? []),
    ...node.styles,
  ]
  for (const item of items) {
    const at = item.indexOf(':')
    const name = item.slice(0, at).trim()
    const value = item.slice(at + 1).trim()
    // Untrusted text lands in a style attribute: keep plain declarations only.
    if (
      !/^-?[a-z][a-z-]*$/i.test(name) ||
      /url\s*\(|@import|expression\s*\(/i.test(value)
    )
      continue
    props.set(name, value)
  }
  return [...props]
}

/** Lay a block diagram out; all coordinates are in Mermaid's space, `viewBox` says where its origin is. */
export function layoutBlock(diagram: BlockDiagram): PositionedBlockDiagram {
  const padding = diagram.padding
  const root = toCell(diagram.root, padding)
  setBlockSizes(root, 0, 0, padding)
  layoutBlocks(root, padding)

  const nodes: PositionedBlockNode[] = []
  const walk = (cell: Cell): void => {
    for (const child of cell.children) {
      const t = child.node.type
      if (t !== 'space' && child.size) {
        nodes.push({
          id: child.node.id,
          type: t,
          shape: child.node.shape,
          x: child.size.x,
          y: child.size.y,
          width: child.size.width,
          height: child.size.height,
          text: { lines: child.lines, width: child.textW },
          classes: child.node.classes,
          css: compileStyles(diagram.classDefs, child.node),
        })
      }
      walk(child)
    }
  }
  walk(root)

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.width / 2)
    minY = Math.min(minY, n.y - n.height / 2)
    maxX = Math.max(maxX, n.x + n.width / 2)
    maxY = Math.max(maxY, n.y + n.height / 2)
  }
  const edges = layoutEdges(diagram.edges, nodes)
  // Mermaid sizes the drawing by the bounding box of everything drawn, edges and labels included.
  for (const e of edges) {
    for (const p of withMarkerOffsets(
      e.points,
      e.arrowTypeStart,
      e.arrowTypeEnd,
    )) {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    }
    if (e.label) {
      minX = Math.min(minX, e.labelX - e.labelWidth / 2)
      maxX = Math.max(maxX, e.labelX + e.labelWidth / 2)
      minY = Math.min(minY, e.labelY - BLOCK.lineHeight / 2)
      maxY = Math.max(maxY, e.labelY + BLOCK.lineHeight / 2)
    }
  }
  if (nodes.length === 0) minX = minY = maxX = maxY = 0
  const m = BLOCK.margin
  return {
    nodes,
    edges,
    viewBox: {
      x: minX - m,
      y: minY - m,
      width: maxX - minX + 2 * m,
      height: maxY - minY + 2 * m,
    },
  }
}
