// ============================================================================
// Shape registry — pluggable ASCII shape renderers
// ============================================================================

import type {
  AsciiNodeShape,
  Canvas,
  DrawingCoord,
  Direction,
} from '../types.ts'
import type {
  ShapeRenderer,
  ShapeDimensions,
  ShapeRenderOptions,
  ShapeRegistry,
} from './types.ts'

// Import all shape renderers
import {
  rectangleRenderer,
  getBoxDimensions,
  renderBox,
  getBoxAttachmentPoint,
} from './rectangle.ts'
import { getCorners } from './corners.ts'
import { mkCanvas } from '../canvas.ts'
import {
  stateStartRenderer,
  stateEndRenderer,
  forkJoinRenderer,
  GLYPH_DIMENSIONS,
} from './state.ts'
import {
  circleDimensions,
  diamondDimensions,
  hexagonDimensions,
  renderSilhouette,
} from './silhouettes.ts'
import { stadiumRenderer } from './stadium.ts'
import { classBoxRenderer, classNameRenderer } from './class-box.ts'
import {
  subroutineRenderer,
  doublecircleRenderer,
  cylinderRenderer,
  asymmetricRenderer,
  trapezoidRenderer,
  trapezoidAltRenderer,
  parallelogramRenderer,
  parallelogramAltRenderer,
} from './special.ts'

// Re-export types
export type {
  ShapeRenderer,
  ShapeDimensions,
  ShapeRenderOptions,
  ShapeRegistry,
}

/**
 * Corner-decorated shape renderers — circle, diamond, rounded. Each one
 * renders a rectangle (`getBoxDimensions`/`renderBox`/`getBoxAttachmentPoint`)
 * with a different corner-marker set pulled from corners.ts's
 * `SHAPE_CORNERS`, instead of drawing curves or diagonals:
 *
 *   circle  (◯)       — circle markers indicate circular shape semantics
 *   diamond (◇)       — diamond markers indicate decision node semantics
 *   rounded (╭╮╰╯)    — rounded markers indicate soft edges
 *
 * Stadium and hexagon are not here: they draw real silhouettes (#2164,
 * silhouettes.ts). Diamond and circle are still approximated.
 *
 * Each renders as (TL/TR/BL/BR = that shape's four corner markers above):
 *   TL─────────TR
 *   │  Label  │
 *   BL─────────BR
 */
function createCornerShapeRenderer(shape: 'rounded'): ShapeRenderer {
  return {
    getDimensions: getBoxDimensions,

    render(label, dimensions, options) {
      const corners = getCorners(shape, options.useAscii)
      return renderBox(label, dimensions, corners, options.useAscii)
    },

    getAttachmentPoint: getBoxAttachmentPoint,
  }
}

export const circleRenderer: ShapeRenderer = {
  getDimensions: circleDimensions,
  render: (label, dimensions, options) =>
    renderSilhouette('circle', label, dimensions, options.useAscii),
  getAttachmentPoint: getBoxAttachmentPoint,
}

/**
 * Unlabeled diamond (a state diagram's `<<choice>>`): a single `◇` glyph, not
 * an empty box, like mermaid's small diamond.
 */
export const diamondRenderer: ShapeRenderer = {
  getDimensions: (label, options) =>
    label === '' ? GLYPH_DIMENSIONS : diamondDimensions(label, options),
  getAttachmentPoint: getBoxAttachmentPoint,
  render(label, dimensions, options) {
    if (label !== '')
      return renderSilhouette('diamond', label, dimensions, options.useAscii)
    const canvas = mkCanvas(0, 0)
    canvas[0]![0] = options.useAscii ? 'o' : '◇'
    return canvas
  },
}
export const roundedRenderer = createCornerShapeRenderer('rounded')
export const hexagonRenderer: ShapeRenderer = {
  getDimensions: hexagonDimensions,
  render: (label, dimensions, options) =>
    renderSilhouette('hexagon', label, dimensions, options.useAscii),
  getAttachmentPoint: getBoxAttachmentPoint,
}

/**
 * Global shape registry — maps shape types to their renderers.
 * Rectangle is the default fallback for unregistered shapes.
 */
export const shapeRegistry: ShapeRegistry = new Map<
  AsciiNodeShape,
  ShapeRenderer
>([
  // Core shapes
  ['rectangle', rectangleRenderer],
  ['rounded', roundedRenderer],
  ['diamond', diamondRenderer],
  ['stadium', stadiumRenderer],
  ['circle', circleRenderer],

  // Batch 1 additions
  ['subroutine', subroutineRenderer],
  ['doublecircle', doublecircleRenderer],
  ['hexagon', hexagonRenderer],

  // Batch 2 additions
  ['cylinder', cylinderRenderer],
  ['asymmetric', asymmetricRenderer],
  ['trapezoid', trapezoidRenderer],
  ['trapezoid-alt', trapezoidAltRenderer],
  ['parallelogram', parallelogramRenderer],
  ['parallelogram-alt', parallelogramAltRenderer],

  // State diagram pseudo-states
  ['state-start', stateStartRenderer],
  ['state-end', stateEndRenderer],
  ['fork-join', forkJoinRenderer],

  // Class diagram LR/RL lowering (class-flow.ts)
  ['class-box', classBoxRenderer],
  ['class-note', classBoxRenderer],
  ['class-name', classNameRenderer],
])

/**
 * Get the renderer for a shape type, falling back to rectangle.
 */
export function getShapeRenderer(shape: AsciiNodeShape): ShapeRenderer {
  return shapeRegistry.get(shape) ?? rectangleRenderer
}

/**
 * Render a node shape to a canvas.
 * This is the main entry point for shape rendering.
 */
export function renderShape(
  shape: AsciiNodeShape,
  label: string,
  options: ShapeRenderOptions,
): Canvas {
  const renderer = getShapeRenderer(shape)
  const dimensions = renderer.getDimensions(label, options)
  return renderer.render(label, dimensions, options)
}

/**
 * Get dimensions for a shape given a label.
 * Used during layout to determine node size.
 */
export function getShapeDimensions(
  shape: AsciiNodeShape,
  label: string,
  options: ShapeRenderOptions,
): ShapeDimensions {
  const renderer = getShapeRenderer(shape)
  return renderer.getDimensions(label, options)
}

/**
 * Get edge attachment point for a shape.
 */
export function getShapeAttachmentPoint(
  shape: AsciiNodeShape,
  dir: Direction,
  dimensions: ShapeDimensions,
  baseCoord: DrawingCoord,
): DrawingCoord {
  const renderer = getShapeRenderer(shape)
  return renderer.getAttachmentPoint(dir, dimensions, baseCoord)
}
