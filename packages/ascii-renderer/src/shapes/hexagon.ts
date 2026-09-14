// ============================================================================
// Hexagon shape renderer — uses corner decorators instead of diagonals
// ============================================================================

import type { ShapeRenderer } from './types.ts'
import {
  getBoxDimensions,
  renderBox,
  getBoxAttachmentPoint,
} from './rectangle.ts'
import { getCorners } from './corners.ts'

/**
 * Hexagon shape renderer.
 * Uses crop-corner markers (⌜⌝⌞⌟, see corners.ts's `SHAPE_CORNERS.hexagon`)
 * to indicate process node semantics — not the hexagon glyph ⬡ (U+2B21)
 * this comment used to claim: JetBrains Mono NL has no glyph for ⬡ at all,
 * and the renderer hasn't actually emitted it since corners.ts moved to
 * the monospace-safe crop-corner style. See issue #1062.
 *
 * Renders as:
 *   ⌜─────────⌝
 *   │  Label  │
 *   ⌞─────────⌟
 */
export const hexagonRenderer: ShapeRenderer = {
  getDimensions: getBoxDimensions,

  render(label, dimensions, options) {
    const corners = getCorners('hexagon', options.useAscii)
    return renderBox(label, dimensions, corners, options.useAscii)
  },

  getAttachmentPoint: getBoxAttachmentPoint,
}
