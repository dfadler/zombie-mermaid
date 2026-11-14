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
  BlockNode,
  PositionedBlockDiagram,
  PositionedBlockNode,
} from '@zombie-mermaid/mermaid-parser'
import { textWidth } from '../timeline/layout.ts'

/** Mermaid's block defaults. */
export const BLOCK = {
  /** Space between cells and around a group's cells (`block.padding`). */
  padding: 8,
  lineHeight: 24,
  /** Space a block adds around its label: 16px high, 32px across (16px for a round block). */
  labelPaddingX: 32,
  roundPaddingX: 16,
  labelPaddingY: 16,
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

function toCell(node: BlockNode): Cell {
  const lines = node.type === 'node' ? labelLines(node.label) : []
  const textW = Math.max(0, ...lines.map((l) => textWidth(l, BLOCK.fontSize)))
  const cell: Cell = {
    node,
    lines,
    textW,
    children: node.children.map(toCell),
  }
  // Measured size of a plain block (`calculateBlockSize`); groups have none yet.
  if (node.type === 'node') {
    cell.size = {
      width:
        textW +
        (node.shape === 'round' ? BLOCK.roundPaddingX : BLOCK.labelPaddingX),
      height: lines.length * BLOCK.lineHeight + BLOCK.labelPaddingY,
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

/** Lay a block diagram out; all coordinates are in Mermaid's space, `viewBox` says where its origin is. */
export function layoutBlock(diagram: BlockDiagram): PositionedBlockDiagram {
  const root = toCell(diagram.root)
  setBlockSizes(root)
  layoutBlocks(root)

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
  if (nodes.length === 0) minX = minY = maxX = maxY = 0
  const m = BLOCK.margin
  return {
    nodes,
    viewBox: {
      x: minX - m,
      y: minY - m,
      width: maxX - minX + 2 * m,
      height: maxY - minY + 2 * m,
    },
  }
}
