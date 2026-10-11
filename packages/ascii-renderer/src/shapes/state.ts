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

/**
 * State start pseudo-state renderer — filled circle in rounded box.
 * Renders as:
 *   ╭───╮
 *   │ ● │   (Unicode)
 *   ╰───╯
 *
 *   .---.
 *   | * |   (ASCII)
 *   '---'
 *
 * This represents the UML initial pseudo-state.
 */
export const stateStartRenderer: ShapeRenderer = {
  getDimensions(_label: string, _options: ShapeRenderOptions): ShapeDimensions {
    // Start state is a 5x3 rounded box with centered symbol
    const width = 5
    const height = 3

    return {
      width,
      height,
      labelArea: { x: 2, y: 1, width: 1, height: 1 },
      gridColumns: [1, 3, 1],
      gridRows: [1, 1, 1],
    }
  },

  render(
    _label: string,
    dimensions: ShapeDimensions,
    options: ShapeRenderOptions,
  ): Canvas {
    const { width, height } = dimensions
    const canvas = mkCanvas(width - 1, height - 1)

    const centerX = Math.floor(width / 2) // = 2

    if (!options.useAscii) {
      // Unicode rounded box with filled circle: ╭───╮ │ ● │ ╰───╯
      canvas[0]![0] = '╭'
      canvas[1]![0] = '─'
      canvas[2]![0] = '─'
      canvas[3]![0] = '─'
      canvas[4]![0] = '╮'

      canvas[0]![1] = '│'
      canvas[centerX]![1] = '●'
      canvas[4]![1] = '│'

      canvas[0]![2] = '╰'
      canvas[1]![2] = '─'
      canvas[2]![2] = '─'
      canvas[3]![2] = '─'
      canvas[4]![2] = '╯'
    } else {
      // ASCII rounded box: .---. | * | '---'
      canvas[0]![0] = '.'
      canvas[1]![0] = '-'
      canvas[2]![0] = '-'
      canvas[3]![0] = '-'
      canvas[4]![0] = '.'

      canvas[0]![1] = '|'
      canvas[centerX]![1] = '*'
      canvas[4]![1] = '|'

      canvas[0]![2] = "'"
      canvas[1]![2] = '-'
      canvas[2]![2] = '-'
      canvas[3]![2] = '-'
      canvas[4]![2] = "'"
    }

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
 * State end pseudo-state renderer — bullseye in double-bordered box.
 * Renders as:
 *   ╔═══╗
 *   ║ ◎ ║   (Unicode)
 *   ╚═══╝
 *
 *   #===#
 *   # * #   (ASCII)
 *   #===#
 *
 * This represents the UML final state. The double border distinguishes it
 * from the start state's single rounded border.
 */
export const stateEndRenderer: ShapeRenderer = {
  getDimensions(_label: string, _options: ShapeRenderOptions): ShapeDimensions {
    // End state is a 5x3 double-bordered box with centered symbol
    const width = 5
    const height = 3

    return {
      width,
      height,
      labelArea: { x: 2, y: 1, width: 1, height: 1 },
      gridColumns: [1, 3, 1],
      gridRows: [1, 1, 1],
    }
  },

  render(
    _label: string,
    dimensions: ShapeDimensions,
    options: ShapeRenderOptions,
  ): Canvas {
    const { width, height } = dimensions
    const canvas = mkCanvas(width - 1, height - 1)

    const centerX = Math.floor(width / 2) // = 2

    if (!options.useAscii) {
      // Unicode double-bordered box with bullseye: ╔═══╗ ║ ◎ ║ ╚═══╝
      canvas[0]![0] = '╔'
      canvas[1]![0] = '═'
      canvas[2]![0] = '═'
      canvas[3]![0] = '═'
      canvas[4]![0] = '╗'

      canvas[0]![1] = '║'
      canvas[centerX]![1] = '◎'
      canvas[4]![1] = '║'

      canvas[0]![2] = '╚'
      canvas[1]![2] = '═'
      canvas[2]![2] = '═'
      canvas[3]![2] = '═'
      canvas[4]![2] = '╝'
    } else {
      // ASCII double-bordered box: #===# # * # #===#
      canvas[0]![0] = '#'
      canvas[1]![0] = '='
      canvas[2]![0] = '='
      canvas[3]![0] = '='
      canvas[4]![0] = '#'

      canvas[0]![1] = '#'
      canvas[centerX]![1] = '*'
      canvas[4]![1] = '#'

      canvas[0]![2] = '#'
      canvas[1]![2] = '='
      canvas[2]![2] = '='
      canvas[3]![2] = '='
      canvas[4]![2] = '#'
    }

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
 * solid one-row bar in a 9x3 cell; a labeled one (flowchart `shape: fork`) is an ordinary
 * corner-decorated box. `drawBoxWithGridDimensions` fills the block.
 */
export const forkJoinRenderer: ShapeRenderer = {
  getDimensions(label: string, options: ShapeRenderOptions): ShapeDimensions {
    if (label !== '') return getBoxDimensions(label, options)
    return {
      width: 9,
      height: 3,
      labelArea: { x: 4, y: 1, width: 1, height: 1 },
      gridColumns: [1, 7, 1],
      gridRows: [1, 1, 1],
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
