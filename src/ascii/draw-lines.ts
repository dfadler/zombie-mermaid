// ============================================================================
// ASCII renderer — line drawing (8-directional lines on the canvas)
//
// Split out of draw.ts.
// ============================================================================

import type { Canvas, DrawingCoord, AsciiEdgeStyle } from './types.ts'
import {
  Up,
  Down,
  Left,
  Right,
  UpperLeft,
  UpperRight,
  LowerLeft,
  LowerRight,
} from './types.ts'
import { determineDirection, dirEquals } from './edge-routing.ts'
import { write } from './canvas.ts'

/**
 * Line character sets for different edge styles.
 * Each style has horizontal, vertical, and diagonal characters for both
 * Unicode (box-drawing) and ASCII (basic punctuation) modes.
 *
 * Unicode dotted: ┄ (horizontal), ┆ (vertical) — U+2504, U+2506
 * Unicode thick:  ━ (horizontal), ┃ (vertical) — U+2501, U+2503
 */
/**
 * Line character sets for different edge styles.
 * Only horizontal and vertical characters - no diagonals.
 * All edges use orthogonal Manhattan routing (90° bends only).
 */
const LINE_CHARS = {
  solid: {
    h: { unicode: '─', ascii: '-' },
    v: { unicode: '│', ascii: '|' },
  },
  dotted: {
    h: { unicode: '┄', ascii: '.' },
    v: { unicode: '┆', ascii: ':' },
  },
  thick: {
    h: { unicode: '━', ascii: '=' },
    v: { unicode: '┃', ascii: '‖' },
  },
} as const

/**
 * Draw a line between two drawing coordinates using orthogonal Manhattan routing.
 * Returns the list of coordinates that were drawn on.
 * offsetFrom/offsetTo control how many cells to skip at the start/end.
 *
 * All lines use 90° bends only - no diagonal lines are produced.
 * For diagonal directions, uses horizontal-first routing (draws horizontal
 * segment, then vertical segment).
 */
export function drawLine(
  canvas: Canvas,
  from: DrawingCoord,
  to: DrawingCoord,
  offsetFrom: number,
  offsetTo: number,
  useAscii: boolean,
  style: AsciiEdgeStyle = 'solid',
): DrawingCoord[] {
  const dir = determineDirection(from, to)
  const drawnCoords: DrawingCoord[] = []

  // Select character set based on style (horizontal and vertical only)
  const chars = LINE_CHARS[style]
  const hChar = useAscii ? chars.h.ascii : chars.h.unicode
  const vChar = useAscii ? chars.v.ascii : chars.v.unicode

  // Pure vertical directions
  if (dirEquals(dir, Up)) {
    for (let y = from.y - offsetFrom; y >= to.y - offsetTo; y--) {
      drawnCoords.push({ x: from.x, y })
      write(canvas, from.x, y, vChar)
    }
  } else if (dirEquals(dir, Down)) {
    for (let y = from.y + offsetFrom; y <= to.y + offsetTo; y++) {
      drawnCoords.push({ x: from.x, y })
      write(canvas, from.x, y, vChar)
    }
  }
  // Pure horizontal directions
  else if (dirEquals(dir, Left)) {
    for (let x = from.x - offsetFrom; x >= to.x - offsetTo; x--) {
      drawnCoords.push({ x, y: from.y })
      write(canvas, x, from.y, hChar)
    }
  } else if (dirEquals(dir, Right)) {
    for (let x = from.x + offsetFrom; x <= to.x + offsetTo; x++) {
      drawnCoords.push({ x, y: from.y })
      write(canvas, x, from.y, hChar)
    }
  }
  // Diagonal directions: use Manhattan routing (horizontal-first, then vertical)
  // UpperLeft: go left first, then up
  else if (dirEquals(dir, UpperLeft)) {
    // Horizontal segment: from.x -> to.x (going left)
    for (let x = from.x - offsetFrom; x >= to.x; x--) {
      drawnCoords.push({ x, y: from.y })
      write(canvas, x, from.y, hChar)
    }
    // Vertical segment: from.y -> to.y (going up)
    for (let y = from.y - 1; y >= to.y - offsetTo; y--) {
      drawnCoords.push({ x: to.x, y })
      write(canvas, to.x, y, vChar)
    }
  }
  // UpperRight: go right first, then up
  else if (dirEquals(dir, UpperRight)) {
    // Horizontal segment: from.x -> to.x (going right)
    for (let x = from.x + offsetFrom; x <= to.x; x++) {
      drawnCoords.push({ x, y: from.y })
      write(canvas, x, from.y, hChar)
    }
    // Vertical segment: from.y -> to.y (going up)
    for (let y = from.y - 1; y >= to.y - offsetTo; y--) {
      drawnCoords.push({ x: to.x, y })
      write(canvas, to.x, y, vChar)
    }
  }
  // LowerLeft: go left first, then down
  else if (dirEquals(dir, LowerLeft)) {
    // Horizontal segment: from.x -> to.x (going left)
    for (let x = from.x - offsetFrom; x >= to.x; x--) {
      drawnCoords.push({ x, y: from.y })
      write(canvas, x, from.y, hChar)
    }
    // Vertical segment: from.y -> to.y (going down)
    for (let y = from.y + 1; y <= to.y + offsetTo; y++) {
      drawnCoords.push({ x: to.x, y })
      write(canvas, to.x, y, vChar)
    }
  }
  // LowerRight: go right first, then down
  // Special case: if x difference is small (1), draw straight vertical at from.x
  // This keeps edges visually aligned with the source node
  else if (dirEquals(dir, LowerRight)) {
    const dx = to.x - from.x
    if (dx <= 1) {
      // Draw vertical line at from.x (source's x-coordinate)
      for (let y = from.y + offsetFrom; y <= to.y + offsetTo; y++) {
        drawnCoords.push({ x: from.x, y })
        write(canvas, from.x, y, vChar)
      }
    } else {
      // Horizontal segment: from.x -> to.x (going right)
      for (let x = from.x + offsetFrom; x <= to.x; x++) {
        drawnCoords.push({ x, y: from.y })
        write(canvas, x, from.y, hChar)
      }
      // Vertical segment: from.y -> to.y (going down)
      for (let y = from.y + 1; y <= to.y + offsetTo; y++) {
        drawnCoords.push({ x: to.x, y })
        write(canvas, to.x, y, vChar)
      }
    }
  }

  return drawnCoords
}
