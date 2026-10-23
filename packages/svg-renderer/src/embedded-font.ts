import type { MonoFontEmbed, RenderOptions } from '@zombie-mermaid/core'

// The Inter subset behind `RenderOptions.embedFont: 'subset'` (#1867) is
// ~15 KB of base64 per bundle format, several times this package's
// remaining size budget, so it lives in its own lazily imported chunk and
// never enters the default import graph. This module holds the cache.
let loaded: MonoFontEmbed | undefined

/**
 * Load the data for `embedFont: 'subset'`. `renderMermaidSVGAsync()` calls
 * this itself; call it (and await it) once before the synchronous
 * `renderMermaidSVG()` when passing `embedFont: 'subset'`. Idempotent.
 */
export async function loadEmbeddedFont(): Promise<void> {
  if (loaded) return
  const m = await import('./generated/inter-font-subset.ts')
  loaded = { family: m.INTER_FONT_FAMILY, faceCss: m.INTER_FONT_FACE_CSS }
}

/** The embed for these options, or undefined when `embedFont` is off. */
export function resolveBodyFont(
  options: Pick<RenderOptions, 'embedFont'>,
): MonoFontEmbed | undefined {
  if (options.embedFont !== 'subset') return undefined
  if (!loaded) {
    throw new Error(
      "embedFont: 'subset' needs its font data loaded first: " +
        'use renderMermaidSVGAsync(), or `await loadEmbeddedFont()` before renderMermaidSVG().',
    )
  }
  return loaded
}
