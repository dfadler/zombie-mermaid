// ============================================================================
// ASCII renderer — debug coordinate overlay (`--coords`)
//
// Annotates a finished, rendered ASCII/Unicode string with spreadsheet-style
// row/column indices — numbered column headers across the top, row numbers
// down the left side — to help debug layout spacing (padding, box sizes,
// edge routing) without having to count characters by hand.
//
// This deliberately overlays the *character* grid of the final rendered
// output, not the internal logical grid used by grid.ts (AsciiGraph's
// node-placement lattice, where each node occupies a 3x3 block on a 4-unit
// step). The internal grid has no 1:1 relationship with rendered character
// columns/rows (column widths and row heights vary per node), so annotating
// it directly wouldn't produce a marker a user looking at the printed
// diagram could actually line up against. The character grid is what's
// visible on screen, so its indices are what's useful to overlay.
// ============================================================================

import { stripOsc8 } from './hyperlinks.ts'

/**
 * Add a column-index ruler (two rows: tens digit, ones digit) above the
 * diagram and a row-index gutter to the left of each line.
 *
 * Purely a string transform over the already-rendered output — safe to
 * apply regardless of diagram type, color mode, or Unicode/ASCII mode.
 */
// Matches SGR color escape sequences (`\x1b[...m`) produced by ansi.ts's
// ansi16/ansi256/truecolor modes. Stripped — along with any OSC 8
// hyperlink sequences (hyperlinks.ts) — only for width MEASUREMENT below;
// the original lines (with codes intact) are still what gets printed.
const ANSI_ESCAPE = /\x1b\[[0-9;]*m/g

export function addCoordsOverlay(rendered: string): string {
  const lines = rendered.split('\n')
  const width = lines.reduce(
    (max, line) =>
      Math.max(max, stripOsc8(line.replace(ANSI_ESCAPE, '')).length),
    0,
  )
  const rowGutterWidth = String(Math.max(0, lines.length - 1)).length

  const gutter = ' '.repeat(rowGutterWidth + 1)
  const tensRow =
    gutter +
    Array.from({ length: width }, (_, x) =>
      String(Math.floor(x / 10) % 10),
    ).join('')
  const onesRow =
    gutter + Array.from({ length: width }, (_, x) => String(x % 10)).join('')

  const bodyLines = lines.map((line, y) => {
    const rowLabel = String(y).padStart(rowGutterWidth, ' ')
    return `${rowLabel} ${line}`
  })

  return [tensRow, onesRow, ...bodyLines].join('\n')
}
