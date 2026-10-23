// ============================================================================
// Class diagram node shapes — only produced by the LR/RL lowering (class-flow.ts)
//
// A class is a multi-compartment box, a note is the same box with rounded
// corners, and an interface name is bare text. All three are drawn by
// `drawMultiBox`/text at whatever size the flowchart grid allotted, so the box
// a class gets here is the one `renderClassAscii` draws top-down.
// ============================================================================

import type { Canvas, DrawingCoord, Direction } from '../types.ts'
import { measureMultiBox } from '../draw-boxes.ts'
import { displayWidth } from '../display-width.ts'
import { getBoxAttachmentPoint } from './rectangle.ts'
import type {
  ShapeDimensions,
  ShapeRenderer,
  ShapeRenderOptions,
} from './types.ts'

/** Separates a class box's compartments inside a node label. */
export const SECTION_SEP = '\u001e'

/** Compartments of a class-box/class-note label (lines within one are `\n`-split). */
export function decodeSections(label: string): string[][] {
  return label.split(SECTION_SEP).map((s) => s.split('\n'))
}

export function encodeSections(sections: string[][]): string {
  return sections.map((s) => s.join('\n')).join(SECTION_SEP)
}

function boxDimensions(
  label: string,
  options: ShapeRenderOptions,
): ShapeDimensions {
  const { width, height } = measureMultiBox(
    decodeSections(label),
    options.padding,
  )
  return {
    width,
    height,
    labelArea: { x: 1, y: 1, width: width - 2, height: height - 2 },
    gridColumns: [1, width - 2, 1],
    gridRows: [1, height - 2, 1],
  }
}

/** Standalone natural-size render, used only through the registry's render(). */
function noRender(): Canvas {
  return []
}

export const classBoxRenderer: ShapeRenderer = {
  getDimensions: boxDimensions,
  render: noRender,
  getAttachmentPoint: getBoxAttachmentPoint,
}

/** An interface name has no border: one row of text, edges meet it directly. */
export const classNameRenderer: ShapeRenderer = {
  getDimensions(label: string): ShapeDimensions {
    const width = displayWidth(label)
    return {
      width,
      height: 1,
      labelArea: { x: 0, y: 0, width, height: 1 },
      gridColumns: [0, Math.max(width - 1, 0), 0],
      gridRows: [0, 0, 0],
    }
  },
  render: noRender,
  getAttachmentPoint(
    dir: Direction,
    dimensions: ShapeDimensions,
    baseCoord: DrawingCoord,
  ): DrawingCoord {
    return getBoxAttachmentPoint(dir, dimensions, baseCoord)
  },
}
