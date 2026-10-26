// ============================================================================
// Stadium (pill) shape renderer — special parentheses-based rendering
// ============================================================================
//
// Mermaid draws a pill with semicircular ends; here the ends are `(` `)` and
// the top/bottom rows are rounded (silhouettes.ts, #2164).

import { splitLines } from '../multiline-utils.ts'
import { displayWidth } from '../display-width.ts'
import type {
  ShapeRenderer,
  ShapeDimensions,
  ShapeRenderOptions,
} from './types.ts'
import { getBoxAttachmentPoint } from './rectangle.ts'
import { renderSilhouette } from './silhouettes.ts'

/**
 * Stadium (pill) shape renderer. Unicode / ASCII:
 *
 *   ╭────────╮      .--------.
 *   (        )      (        )
 *   (  Label )      (  Label )
 *   (        )      (        )
 *   ╰────────╯      '--------'
 */
export const stadiumRenderer: ShapeRenderer = {
  getDimensions(label: string, options: ShapeRenderOptions): ShapeDimensions {
    const lines = splitLines(label)
    const maxLineWidth = Math.max(...lines.map((l) => displayWidth(l)), 0)
    const lineCount = lines.length

    const innerWidth = 2 * options.padding + maxLineWidth
    const width = innerWidth + 4 // Extra for rounded ends
    const innerHeight = lineCount + 2 * options.padding
    const height = Math.max(innerHeight + 2, 3)

    return {
      width,
      height,
      labelArea: {
        x: 2 + options.padding,
        y: 1 + options.padding,
        width: maxLineWidth,
        height: lineCount,
      },
      gridColumns: [2, innerWidth, 2],
      gridRows: [1, innerHeight, 1],
    }
  },

  render: (label, dimensions, options) =>
    renderSilhouette('stadium', label, dimensions, options.useAscii),

  getAttachmentPoint: getBoxAttachmentPoint,
}
