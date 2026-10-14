// ============================================================================
// State pseudo-state renderers — UML start and end states
// ============================================================================

import type { Canvas, DrawingCoord, Direction } from '../types.ts'
import { Up, Down, Left, Right } from '../types.ts'
import { mkCanvas } from '../canvas.ts'
import type {
  ShapeRenderer,
  ShapeDimensions,
  ShapeRenderOptions,
} from './types.ts'
import { dirEquals } from '../edge-routing.ts'
import {
  getBoxDimensions,
  renderBox,
  getBoxAttachmentPoint,
} from './rectangle.ts'
import { getCorners } from './corners.ts'

/** A pseudo-state is one glyph (●, ◉, ◇), with no border, like mermaid's circle. */
export const GLYPH_DIMENSIONS: ShapeDimensions = {
  width: 1,
  height: 1,
  labelArea: { x: 0, y: 0, width: 1, height: 1 },
  gridColumns: [0, 0, 0],
  gridRows: [0, 0, 0],
}

/**
 * State start pseudo-state renderer — a single filled circle.
 * Renders as `●` (Unicode) or `*` (ASCII). This represents the UML initial pseudo-state.
 */
export const stateStartRenderer: ShapeRenderer = {
  getDimensions(_label: string, _options: ShapeRenderOptions): ShapeDimensions {
    return GLYPH_DIMENSIONS
  },

  render(
    _label: string,
    dimensions: ShapeDimensions,
    options: ShapeRenderOptions,
  ): Canvas {
    const canvas = mkCanvas(dimensions.width - 1, dimensions.height - 1)
    canvas[0]![0] = options.useAscii ? '*' : '●'
    return canvas
  },

  getAttachmentPoint(
    dir: Direction,
    dimensions: ShapeDimensions,
    baseCoord: DrawingCoord,
  ): DrawingCoord {
    const { width, height } = dimensions
    const centerX = baseCoord.x + Math.floor(width / 2)
    const centerY = baseCoord.y + Math.floor(height / 2)

    if (dirEquals(dir, Up)) return { x: centerX, y: baseCoord.y }
    if (dirEquals(dir, Down)) return { x: centerX, y: baseCoord.y + height - 1 }
    if (dirEquals(dir, Left)) return { x: baseCoord.x, y: centerY }
    if (dirEquals(dir, Right)) return { x: baseCoord.x + width - 1, y: centerY }
    // All diagonals and middle point to center
    return { x: centerX, y: centerY }
  },
}

/**
 * State end pseudo-state renderer — a single bullseye.
 * Renders as `◉` (Unicode) or `@` (ASCII). This represents the UML final
 * state; the bullseye distinguishes it from the start state's solid dot.
 */
export const stateEndRenderer: ShapeRenderer = {
  getDimensions(_label: string, _options: ShapeRenderOptions): ShapeDimensions {
    return GLYPH_DIMENSIONS
  },

  render(
    _label: string,
    dimensions: ShapeDimensions,
    options: ShapeRenderOptions,
  ): Canvas {
    const canvas = mkCanvas(dimensions.width - 1, dimensions.height - 1)
    canvas[0]![0] = options.useAscii ? '@' : '◉'
    return canvas
  },

  getAttachmentPoint(
    dir: Direction,
    dimensions: ShapeDimensions,
    baseCoord: DrawingCoord,
  ): DrawingCoord {
    const { width, height } = dimensions
    const centerX = baseCoord.x + Math.floor(width / 2)
    const centerY = baseCoord.y + Math.floor(height / 2)

    if (dirEquals(dir, Up)) return { x: centerX, y: baseCoord.y }
    if (dirEquals(dir, Down)) return { x: centerX, y: baseCoord.y + height - 1 }
    if (dirEquals(dir, Left)) return { x: baseCoord.x, y: centerY }
    if (dirEquals(dir, Right)) return { x: baseCoord.x + width - 1, y: centerY }
    // All diagonals and middle point to center
    return { x: centerX, y: centerY }
  },
}

/**
 * Fork/join bar. Unlabeled (a state diagram's `<<fork>>`/`<<join>>`) it is a
 * solid one-row bar in a 9x1 cell; a labeled one (flowchart `shape: fork`) is an ordinary
 * corner-decorated box. `drawBoxWithGridDimensions` fills the block.
 */
export const forkJoinRenderer: ShapeRenderer = {
  getDimensions(label: string, options: ShapeRenderOptions): ShapeDimensions {
    if (label !== '') return getBoxDimensions(label, options)
    return {
      width: 9,
      height: 1,
      labelArea: { x: 4, y: 0, width: 1, height: 1 },
      gridColumns: [1, 7, 1],
      gridRows: [0, 0, 0],
    }
  },

  render(label, dimensions, options) {
    const { width, height } = dimensions
    const canvas = mkCanvas(width - 1, height - 1)
    const fill = options.useAscii ? '#' : '█'
    if (label !== '') {
      return renderBox(
        label,
        dimensions,
        getCorners('fork-join', options.useAscii),
        options.useAscii,
      )
    }
    for (let x = 0; x < width; x++) canvas[x]![Math.floor(height / 2)] = fill
    return canvas
  },

  getAttachmentPoint: getBoxAttachmentPoint,
}
