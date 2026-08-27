// ============================================================================
// ASCII renderer — node/box drawing
//
// Split out of draw.ts. Renders individual node shapes and the
// multi-section boxes used by class/ER diagram nodes.
// ============================================================================

import type {
  Canvas,
  DrawingCoord,
  AsciiGraph,
  AsciiNode,
  CharRole,
} from './types.ts'
import { mkCanvas, write } from './canvas.ts'
import { splitLines } from './multiline-utils.ts'
import { getCorners } from './shapes/corners.ts'
import { displayWidth, toDisplayCells } from './display-width.ts'

// ============================================================================
// Node drawing — renders a node using shape-aware rendering
// ============================================================================

/**
 * Draw a node using its shape type.
 * Returns a standalone canvas containing the rendered shape.
 *
 * For basic shapes (rectangle, rounded), uses grid-determined dimensions
 * to ensure consistent sizing across nodes in the same column.
 * For special shapes (diamond, circle, state pseudo-states, etc.),
 * uses shape-specific dimension calculation but centers the content
 * within the grid cell dimensions to ensure proper vertical alignment.
 */
export function drawNode(node: AsciiNode, graph: AsciiGraph): Canvas {
  // All shapes use grid-determined dimensions to fill their allocated space.
  // This ensures consistent sizing across nodes and eliminates gaps between
  // nodes and subgraph borders. All shapes are rectangles with distinctive
  // corner characters (defined in corners.ts) to indicate shape type.
  return drawBoxWithGridDimensions(node, graph)
}

/**
 * Draw a box shape using grid-determined dimensions.
 * This ensures consistent sizing when multiple nodes share a column,
 * and eliminates gaps between nodes and subgraph borders by filling
 * the entire allocated grid space.
 *
 * All shapes are rendered as rectangles with distinctive corner characters
 * (defined in corners.ts) to indicate shape type.
 */
function drawBoxWithGridDimensions(node: AsciiNode, graph: AsciiGraph): Canvas {
  const gc = node.gridCoord
  if (gc === null) {
    // Every node is guaranteed a gridCoord before drawing starts —
    // createMapping (grid.ts) seeds even nodes in otherwise-unreachable
    // cycles with a pseudo-root (see addPseudoRootsForUnreachableCycles)
    // specifically so every node gets placed. A null here means that
    // invariant was violated upstream, which is validated explicitly
    // rather than trusted silently since the type checker can't see it.
    /* v8 ignore next */
    throw new Error(`drawNode: node "${node.name}" has no gridCoord assigned`)
  }
  const useAscii = graph.config.useAscii

  // Width spans 2 columns (border + content) - matching original behavior
  let w = 0
  for (let i = 0; i < 2; i++) {
    w += graph.columnWidth.get(gc.x + i) ?? 0
  }
  // Height spans 2 rows (border + content)
  let h = 0
  for (let i = 0; i < 2; i++) {
    h += graph.rowHeight.get(gc.y + i) ?? 0
  }

  const from: DrawingCoord = { x: 0, y: 0 }
  const to: DrawingCoord = { x: w, y: h }
  const box = mkCanvas(Math.max(from.x, to.x), Math.max(from.y, to.y))

  // Get corner characters for this shape type
  const corners = getCorners(node.shape, useAscii)

  // State-end uses double border to differentiate from state-start
  const isDoubleBox = node.shape === 'state-end'
  const hChar = useAscii ? (isDoubleBox ? '=' : '-') : isDoubleBox ? '═' : '─'
  const vChar = useAscii ? (isDoubleBox ? '‖' : '|') : isDoubleBox ? '║' : '│'

  // Double-box corners (for state-end)
  const doubleCorners = useAscii
    ? { tl: '#', tr: '#', bl: '#', br: '#' }
    : { tl: '╔', tr: '╗', bl: '╚', br: '╝' }
  const effectiveCorners = isDoubleBox ? doubleCorners : corners

  // Draw box border with shape-specific corners
  for (let x = from.x + 1; x < to.x; x++) write(box, x, from.y, hChar)
  for (let x = from.x + 1; x < to.x; x++) write(box, x, to.y, hChar)
  for (let y = from.y + 1; y < to.y; y++) write(box, from.x, y, vChar)
  for (let y = from.y + 1; y < to.y; y++) write(box, to.x, y, vChar)
  write(box, from.x, from.y, effectiveCorners.tl)
  write(box, to.x, from.y, effectiveCorners.tr)
  write(box, from.x, to.y, effectiveCorners.bl)
  write(box, to.x, to.y, effectiveCorners.br)

  // Center the multi-line display label inside the box
  const label = node.displayLabel
  const lines = splitLines(label)
  const textCenterY = from.y + Math.floor(h / 2)
  const startY = textCenterY - Math.floor((lines.length - 1) / 2)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const lineWidth = displayWidth(line)
    const textX = from.x + Math.floor(w / 2) - Math.ceil(lineWidth / 2) + 1
    const cells = toDisplayCells(line)
    for (let j = 0; j < cells.length; j++) {
      write(box, textX + j, startY + i, cells[j]!)
    }
  }

  return box
}

/**
 * Draw a node box with centered label text.
 * Returns a standalone canvas containing just the box.
 * Box size is determined by the grid column/row sizes for the node's position.
 */
export function drawBox(node: AsciiNode, graph: AsciiGraph): Canvas {
  return drawNode(node, graph)
}

// ============================================================================
// Multi-section box drawing — for class and ER diagram nodes
// ============================================================================

/**
 * Classify a character from a multi-section box drawing as 'border' or 'text'.
 * Shared by the class and ER diagram ASCII renderers, which both copy a
 * `drawMultiBox` canvas onto their main canvas and need to tag each
 * non-blank cell with its role for colored output.
 */
export function classifyBoxChar(ch: string): CharRole {
  if (/^[┌┐└┘├┤┬┴┼│─╭╮╰╯+\-|]$/.test(ch)) return 'border'
  return 'text'
}

/**
 * Draw a multi-section box with horizontal dividers between sections.
 * Used by class diagrams (header | attributes | methods) and ER diagrams (header | attributes).
 * Each section is an array of text lines to render left-aligned with padding.
 *
 * @param sections - Array of sections, each section is an array of text lines
 * @param useAscii - true for ASCII chars, false for Unicode box-drawing
 * @param padding - horizontal padding inside the box (default 1)
 * @returns A standalone Canvas containing the multi-section box
 */
export function drawMultiBox(
  sections: string[][],
  useAscii: boolean,
  padding: number = 1,
): Canvas {
  // Compute width: widest line across all sections + 2*padding + 2 border chars
  let maxTextWidth = 0
  for (const section of sections) {
    for (const line of section) {
      maxTextWidth = Math.max(maxTextWidth, line.length)
    }
  }
  const innerWidth = maxTextWidth + 2 * padding
  const boxWidth = innerWidth + 2 // +2 for left/right border

  // Compute height: sum of all section line counts + dividers + 2 border rows
  let totalLines = 0
  for (const section of sections) {
    totalLines += Math.max(section.length, 1) // at least 1 row per section
  }
  const numDividers = sections.length - 1
  const boxHeight = totalLines + numDividers + 2 // +2 for top/bottom border

  // Box-drawing characters
  const hLine = useAscii ? '-' : '─'
  const vLine = useAscii ? '|' : '│'
  const tl = useAscii ? '+' : '┌'
  const tr = useAscii ? '+' : '┐'
  const bl = useAscii ? '+' : '└'
  const br = useAscii ? '+' : '┘'
  const divL = useAscii ? '+' : '├'
  const divR = useAscii ? '+' : '┤'

  const canvas = mkCanvas(boxWidth - 1, boxHeight - 1)

  // Top border
  write(canvas, 0, 0, tl)
  for (let x = 1; x < boxWidth - 1; x++) write(canvas, x, 0, hLine)
  write(canvas, boxWidth - 1, 0, tr)

  // Bottom border
  write(canvas, 0, boxHeight - 1, bl)
  for (let x = 1; x < boxWidth - 1; x++) write(canvas, x, boxHeight - 1, hLine)
  write(canvas, boxWidth - 1, boxHeight - 1, br)

  // Left and right borders (full height)
  for (let y = 1; y < boxHeight - 1; y++) {
    write(canvas, 0, y, vLine)
    write(canvas, boxWidth - 1, y, vLine)
  }

  // Render sections with dividers
  let row = 1 // current y position (starts after top border)
  for (let s = 0; s < sections.length; s++) {
    const section = sections[s]!
    const lines = section.length > 0 ? section : ['']

    // Draw section text lines
    for (const line of lines) {
      const startX = 1 + padding
      for (let i = 0; i < line.length; i++) {
        write(canvas, startX + i, row, line[i]!)
      }
      row++
    }

    // Draw divider after each section except the last
    if (s < sections.length - 1) {
      write(canvas, 0, row, divL)
      for (let x = 1; x < boxWidth - 1; x++) write(canvas, x, row, hLine)
      write(canvas, boxWidth - 1, row, divR)
      row++
    }
  }

  return canvas
}
