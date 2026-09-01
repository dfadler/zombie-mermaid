// ============================================================================
// ASCII renderer — display width helpers
//
// The ASCII grid is column-major with one grid cell reserved per *grapheme
// cluster* — the Unicode notion of a single user-perceived character, which
// may span several JS code points. Measuring by code point instead breaks in
// two opposite directions:
//
//   - A combining mark (e.g. decomposed "e" + U+0301 COMBINING ACUTE ACCENT)
//     is its own code point but claims no terminal column of its own — it
//     attaches to the preceding base character. Counting it as a full column
//     overcounts (issue #205).
//   - A composed emoji sequence (ZWJ family emoji, flag via regional
//     indicators, skin-tone modifier) is several code points that render as
//     ONE glyph occupying at most 2 terminal columns. Counting each code
//     point separately overcounts even more badly (issue #214).
//
// Segmenting by grapheme cluster (`Intl.Segmenter`) and measuring each
// cluster as a unit fixes both: a cluster is 2 columns if any code point
// within it is "wide" (CJK etc, via the same `isWideChar` the SVG
// text-measurement path uses), else 1 column — except a cluster made
// entirely of combining marks with no base character, which is 0 columns
// (the degenerate case the general Unicode categories Mn/Me describe;
// ordinarily unreachable since a mark attaches to a preceding base within
// the same cluster, but handled explicitly for a lone/leading mark).
//
// This module is the single source of truth for "how many terminal columns
// does this text occupy" and "how many grid cells does writing it need"
// across the ASCII renderer.
// ============================================================================

import { isWideChar } from '../text-metrics.ts'

/**
 * Placeholder written into the grid cell immediately following a wide
 * grapheme cluster. It reserves a grid column — keeping every subsequent
 * cell's x-index aligned with the same column in other rows (borders, other
 * labels, etc.) — but contributes no text when a canvas row is joined into
 * a string, because the wide glyph itself already renders across two
 * terminal columns.
 */
export const WIDE_CHAR_PLACEHOLDER = ''

/** Unicode general categories Mn (Nonspacing_Mark) and Me (Enclosing_Mark). */
const COMBINING_MARK_REGEX = /\p{Mn}|\p{Me}/u

function isCombiningMark(char: string): boolean {
  return COMBINING_MARK_REGEX.test(char)
}

const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
})

/**
 * U+FE0F VARIATION SELECTOR-16 explicitly requests the emoji (wide)
 * presentation for the preceding base character, overriding whatever that
 * character's own default presentation is. `isWideChar` only ever sees one
 * isolated code point at a time (it's shared with the SVG text-measurement
 * path, which has no grapheme-cluster concept), so it has no way to look
 * ahead for a following VS16 — that requires cluster-level context, which
 * only exists here. A base character normally classified narrow (e.g. ▶
 * U+25B6, excluded from `isWideChar` as a Geometric Shapes glyph — see
 * `isGeometricShapesTextDefault` in text-metrics.ts) still renders as a
 * double-width emoji glyph in ▶️ once VS16 forces emoji presentation.
 */
const VARIATION_SELECTOR_16 = '\u{FE0F}'

/**
 * Split text into grapheme clusters — user-perceived characters. A cluster
 * may span multiple JS code points: a combining mark attaches to its base
 * character, and a ZWJ emoji sequence / flag / skin-tone modifier sequence
 * forms a single rendered glyph. Naive code-point iteration (`for...of`)
 * tears these apart, which is the root cause of both #205 and #214.
 */
function graphemeClusters(text: string): string[] {
  const clusters: string[] = []
  for (const { segment } of graphemeSegmenter.segment(text)) {
    clusters.push(segment)
  }
  return clusters
}

/**
 * Number of terminal display columns a single grapheme cluster occupies.
 * Always 0, 1, or 2 for the ASCII grid (unlike the fractional SVG metrics in
 * `text-metrics.ts`, which model proportional-font rendering).
 *
 * - 2 if any code point in the cluster is "wide" (`isWideChar`) — covers
 *   both plain CJK/fullwidth characters and composed emoji sequences, since
 *   the sequence's base emoji code point is itself flagged wide.
 * - 0 if the cluster consists entirely of combining marks (Mn/Me) with no
 *   base character — a degenerate case in practice, since a mark normally
 *   attaches to a preceding base within the same cluster instead of forming
 *   a standalone one.
 * - 1 otherwise, including a base character followed by zero-width
 *   combining marks (e.g. decomposed "é"), since the marks contribute no
 *   additional column within their cluster.
 *
 * A cluster containing VS16 (see `VARIATION_SELECTOR_16` above) is always
 * width 2, regardless of what `isWideChar` reports for its base character —
 * VS16 is an explicit, cluster-level request for emoji presentation that a
 * single isolated code point can't express.
 */
export function charDisplayWidth(cluster: string): number {
  if (cluster.includes(VARIATION_SELECTOR_16)) return 2
  let sawWide = false
  let sawNonMark = false
  for (const ch of cluster) {
    if (isWideChar(ch)) sawWide = true
    if (!isCombiningMark(ch)) sawNonMark = true
  }
  if (sawWide) return 2
  return sawNonMark ? 1 : 0
}

/**
 * Total terminal display width of a string, measured per grapheme cluster
 * (not per code point or UTF-16 code unit) so combining marks and composed
 * emoji sequences are each counted once, correctly.
 */
export function displayWidth(text: string): number {
  let width = 0
  for (const cluster of graphemeClusters(text)) {
    width += charDisplayWidth(cluster)
  }
  return width
}

/**
 * Split a string into grid cells for canvas writing.
 *
 * Each grapheme cluster produces one cell containing the full cluster text
 * (so a combining mark shares its base character's cell instead of
 * claiming one of its own). A wide cluster (display width 2) additionally
 * produces a trailing `WIDE_CHAR_PLACEHOLDER` cell. This keeps grid-cell
 * count in sync with display-column count so that box-width math (computed
 * via `displayWidth`) and the actual character-writing loop agree — a
 * zero-width cluster (a lone combining mark with no base) contributes no
 * cell at all, since it claims no column.
 */
export function toDisplayCells(text: string): string[] {
  const cells: string[] = []
  for (const cluster of graphemeClusters(text)) {
    const width = charDisplayWidth(cluster)
    if (width === 0) continue
    cells.push(cluster)
    if (width === 2) cells.push(WIDE_CHAR_PLACEHOLDER)
  }
  return cells
}
