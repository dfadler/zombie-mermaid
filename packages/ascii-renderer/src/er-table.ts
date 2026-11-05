// ============================================================================
// ASCII renderer — ER entity table
//
// Mermaid draws an entity as a centred name over a grid: one column per
// attribute part (type, name, keys, comment), a divider between columns and
// a divider between rows. `drawMultiBox` (shared with class diagrams) has no
// columns, so the ER box is drawn here and class output is untouched.
// ============================================================================

import type { Canvas } from './types.ts'
import { mkCanvas, write } from './canvas.ts'
import { displayWidth, toDisplayCells } from './display-width.ts'

export interface EntityTable {
  /** Name lines, centred. */
  header: string[]
  /** One array of cell texts per attribute row (equal length). */
  rows: string[][]
  /** Blank lines added inside the last row (room for self-loop markers). */
  padLines?: number
}

interface TableMetrics {
  colW: number[]
  width: number
  height: number
}

function metrics(t: EntityTable, padding: number): TableMetrics {
  const pad = Math.max(0, padding)
  const cols = t.rows[0]?.length ?? 0
  const colW = Array.from({ length: cols }, (_, c) =>
    Math.max(...t.rows.map((r) => displayWidth(r[c] ?? ''))),
  )
  const headW = Math.max(0, ...t.header.map(displayWidth)) + 2 * pad
  const gridW = colW.reduce((n, w) => n + w + 2 * pad, 0) + cols + 1
  const width = Math.max(headW + 2, gridW)
  // The last column takes whatever the name needs beyond the grid.
  if (cols > 0) colW[cols - 1]! += width - gridW
  const headLines = Math.max(t.header.length, 1)
  const height =
    t.rows.length === 0
      ? headLines + 2
      : headLines + 3 + 2 * t.rows.length - 1 + (t.padLines ?? 0)
  return { colW, width, height }
}

export function measureEntityTable(
  t: EntityTable,
  padding = 1,
): { width: number; height: number } {
  const { width, height } = metrics(t, padding)
  return { width, height }
}

export function drawEntityTable(
  t: EntityTable,
  useAscii: boolean,
  padding = 1,
): Canvas {
  const pad = Math.max(0, padding)
  const { colW, width, height } = metrics(t, padding)
  const h = useAscii ? '-' : '─'
  const v = useAscii ? '|' : '│'
  const c = (u: string): string => (useAscii ? (u === '─' ? '-' : '+') : u)
  const canvas = mkCanvas(width - 1, height - 1)

  // Column separator x positions (inside the box).
  const seps: number[] = []
  let x = 0
  for (const w of colW.slice(0, -1)) {
    x += w + 2 * pad + 1
    seps.push(x)
  }

  const hRule = (y: number, l: string, mid: string, r: string): void => {
    write(canvas, 0, y, c(l))
    for (let i = 1; i < width - 1; i++) write(canvas, i, y, h)
    for (const s of seps) write(canvas, s, y, c(mid))
    write(canvas, width - 1, y, c(r))
  }

  hRule(0, '┌', '─', '┐')
  const headLines = Math.max(t.header.length, 1)
  for (let i = 0; i < headLines; i++) {
    const cells = toDisplayCells(t.header[i] ?? '')
    const sx = 1 + Math.floor((width - 2 - cells.length) / 2)
    write(canvas, 0, 1 + i, v)
    write(canvas, width - 1, 1 + i, v)
    cells.forEach((ch, j) => write(canvas, sx + j, 1 + i, ch))
  }
  let y = 1 + headLines
  if (t.rows.length === 0) {
    // Header-only entity: plain box, no grid below.
    hRule(y, '└', '┴', '┘')
    return canvas
  }
  hRule(y, '├', '┬', '┤')
  t.rows.forEach((row, r) => {
    y++
    const lines = r === t.rows.length - 1 ? 1 + (t.padLines ?? 0) : 1
    for (let l = 0; l < lines; l++) {
      write(canvas, 0, y + l, v)
      write(canvas, width - 1, y + l, v)
      for (const s of seps) write(canvas, s, y + l, v)
    }
    let cx = 1 + pad
    row.forEach((text, ci) => {
      toDisplayCells(text).forEach((ch, j) => write(canvas, cx + j, y, ch))
      cx += colW[ci]! + 2 * pad + 1
    })
    y += lines - 1
    if (r < t.rows.length - 1) {
      y++
      hRule(y, '├', '┼', '┤')
    }
  })
  y++
  hRule(y, '└', '┴', '┘')
  return canvas
}

/** Rows (relative to the box top) that are horizontal rules inside the grid. */
export function tableRuleRows(t: EntityTable): Set<number> {
  const rules = new Set<number>()
  if (t.rows.length === 0) return rules
  const head = Math.max(t.header.length, 1)
  rules.add(1 + head)
  for (let r = 0; r < t.rows.length - 1; r++) rules.add(3 + head + 2 * r)
  return rules
}
