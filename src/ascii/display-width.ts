// ============================================================================
// ASCII renderer — display width helpers
//
// The ASCII grid is column-major with one grid cell reserved per JS code
// point. CJK/kana/hangul/fullwidth-form/emoji characters, however, occupy
// TWO columns in a real monospace terminal, not one. Left unaccounted for,
// this makes any box/label containing such characters too narrow, and the
// borders around it stop lining up.
//
// This module is the single source of truth for "how many terminal columns
// does this text occupy" and "how many grid cells does writing it need"
// across the ASCII renderer, reusing the same wide-character detection
// (`isWideChar`) the SVG text-measurement path already relies on.
// ============================================================================

import { isWideChar } from '../text-metrics.ts'

/**
 * Placeholder written into the grid cell immediately following a wide
 * character. It reserves a grid column — keeping every subsequent cell's
 * x-index aligned with the same column in other rows (borders, other
 * labels, etc.) — but contributes no text when a canvas row is joined into
 * a string, because the wide glyph itself already renders across two
 * terminal columns.
 */
export const WIDE_CHAR_PLACEHOLDER = ''

/**
 * Number of terminal display columns a single character occupies.
 * Always 1 or 2 for the ASCII grid (unlike the fractional SVG metrics in
 * `text-metrics.ts`, which model proportional-font rendering).
 */
export function charDisplayWidth(char: string): number {
  return isWideChar(char) ? 2 : 1
}

/**
 * Total terminal display width of a string. Fullwidth/CJK/emoji characters
 * count as 2 columns each; everything else counts as 1. Iterates by code
 * point (not UTF-16 code unit) so surrogate-pair characters (e.g. many
 * emoji) are measured correctly.
 */
export function displayWidth(text: string): number {
  let width = 0
  for (const ch of text) width += charDisplayWidth(ch)
  return width
}

/**
 * Split a string into grid cells for canvas writing.
 *
 * Each narrow character produces one cell containing that character. Each
 * wide character produces two cells: the glyph itself followed by a
 * `WIDE_CHAR_PLACEHOLDER` cell. This keeps grid-cell count in sync with
 * display-column count so that box-width math (computed via `displayWidth`)
 * and the actual character-writing loop agree.
 */
export function toDisplayCells(text: string): string[] {
  const cells: string[] = []
  for (const ch of text) {
    cells.push(ch)
    if (isWideChar(ch)) cells.push(WIDE_CHAR_PLACEHOLDER)
  }
  return cells
}
