/**
 * Render ASCII art as an HTML string with terminal column semantics
 * preserved — shared by the repo's static before/after report generators
 * (fork-fixes.ts, scripts/visual-diff.ts), which run in Node and build
 * plain HTML strings rather than live DOM (see demo/client.ts's
 * `applyWideCharWidths` for the DOM equivalent used by the live gallery
 * and the Vitest visual-regression suite).
 *
 * Lives at the repo root rather than under demo/: demo/tsconfig.json's
 * `rootDir` is scoped to demo/ itself, and this needs `src/text-metrics.ts`.
 *
 * A terminal gives every wide (CJK/fullwidth/emoji) glyph exactly two
 * columns — that rule is what the ASCII renderer's box math is built on. A
 * browser gives it whatever the fallback font's advance happens to be, so
 * each wide cluster is boxed to the column count the renderer allocated for
 * it, reproducing the terminal's geometry. See src/ascii/display-width.ts
 * for the canonical column-counting rules this mirrors.
 */
import { isWideChar } from './src/text-metrics.ts'
import { escapeHtml } from './demo/format.ts'

const COMBINING_MARK_REGEX = /\p{Mn}|\p{Me}/u

/** Mirrors `charDisplayWidth` in `src/ascii/display-width.ts` — see there. */
function clusterDisplayWidth(cluster: string): number {
  let sawWide = false
  let sawNonMark = false
  for (const ch of cluster) {
    if (isWideChar(ch)) sawWide = true
    if (!COMBINING_MARK_REGEX.test(ch)) sawNonMark = true
  }
  if (sawWide) return 2
  return sawNonMark ? 1 : 0
}

export function asciiToHtml(text: string): string {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  let out = ''
  for (const { segment } of segmenter.segment(text)) {
    const width = clusterDisplayWidth(segment)
    out +=
      width > 1
        ? `<span class="fix-wide" style="width:${width}ch">${escapeHtml(segment)}</span>`
        : escapeHtml(segment)
  }
  return out
}
