/**
 * Shared defaults for the ELK-based layout engine.
 * Split out of layout-engine.ts so both the ELK conversion and the
 * post-processing stages (layer alignment, elk-result conversion) can
 * reference the same values without importing the top-level module.
 */

/** Default render options (layout-only) */
export const DEFAULTS = {
  font: 'Inter',
  padding: 40,
  nodeSpacing: 28,
  layerSpacing: 48,
  mergeEdges: true,
  thoroughness: 3,
} as const
