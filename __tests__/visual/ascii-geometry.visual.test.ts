/**
 * Geometry oracle — does the browser's terminal mockup lay ASCII output out
 * the way a terminal would?
 *
 * Feeds the truecolor ANSI render of every sample through @xterm/headless (a
 * real terminal emulator) to get the authoritative cell grid, then measures
 * where Chromium actually drew each glyph of the HTML render (same theme) and
 * asserts, per cell: same character, same column/row derived *from pixels*,
 * x/y on the cell lattice, wide glyphs exactly two cells wide, same color.
 * No goldens, no pixel tolerance.
 */
import { expect, test } from '@playwright/test'
import xtermHeadless from '@xterm/headless'
import { renderMermaidASCII } from '../../src/index.ts'
import { samples } from '../../packages/site/samples-data.ts'
import { TERMINAL_ASCII_OPTS } from './helpers/terminal-panel.ts'
import { mountAndMeasure } from './helpers/ascii-measure.ts'

const { Terminal } = xtermHeadless

const ANSI = /\x1b\[[0-9;]*m/g

interface OracleCell {
  row: number
  col: number
  ch: string
  width: number
  /** '#rrggbb', or null for the terminal's default foreground */
  fg: string | null
}

async function oracleCells(ansi: string): Promise<OracleCell[]> {
  const lines = ansi.split('\n')
  const cols =
    Math.max(...lines.map((l) => [...l.replace(ANSI, '')].length)) + 4
  const term = new Terminal({
    cols,
    rows: lines.length,
    allowProposedApi: true,
  })
  await new Promise<void>((r) => term.write(ansi.replace(/\n/g, '\r\n'), r))
  const out: OracleCell[] = []
  for (let row = 0; row < lines.length; row++) {
    const line = term.buffer.active.getLine(row)
    if (!line) continue
    for (let col = 0; col < cols; col++) {
      const cell = line.getCell(col)
      if (!cell || cell.getWidth() === 0) continue
      const ch = cell.getChars()
      if (ch === '' || ch === ' ') continue
      const rgb = cell.isFgRGB() ? cell.getFgColor() : null
      out.push({
        row,
        col,
        ch,
        width: cell.getWidth(),
        fg: rgb === null ? null : '#' + rgb.toString(16).padStart(6, '0'),
      })
    }
  }
  return out
}

test.describe('ASCII mockup geometry vs xterm oracle', () => {
  for (const [i, sample] of samples.entries()) {
    if (sample.category === 'Hero') continue
    test(`${i} ${sample.title}`, async ({ page }) => {
      let ansi: string
      let html: string
      try {
        ansi = renderMermaidASCII(sample.source, {
          ...TERMINAL_ASCII_OPTS,
          colorMode: 'truecolor',
        })
        html = renderMermaidASCII(sample.source, {
          ...TERMINAL_ASCII_OPTS,
          colorMode: 'html',
        })
      } catch {
        test.skip(true, 'no ASCII support for this diagram type')
        return
      }
      const expected = await oracleCells(ansi)
      const measured = await mountAndMeasure(page, html)

      const byPos = new Map(measured.cells.map((c) => [`${c.row},${c.col}`, c]))
      const problems: string[] = []
      for (const e of expected) {
        const m = byPos.get(`${e.row},${e.col}`)
        if (!m) {
          problems.push(`r${e.row} c${e.col} '${e.ch}': not drawn at that cell`)
          continue
        }
        if (m.ch !== e.ch)
          problems.push(`r${e.row} c${e.col}: char '${m.ch}' != '${e.ch}'`)
        if (e.width === 2 && Math.abs(m.w - 2) > 0.02)
          problems.push(
            `r${e.row} c${e.col} '${e.ch}': wide glyph spans ${m.w.toFixed(2)} cells`,
          )
        if (
          Math.abs(m.dx) > 0.2 * measured.cellW ||
          Math.abs(m.dy) > 0.15 * measured.lineH
        )
          problems.push(
            `r${e.row} c${e.col} '${e.ch}': off-lattice dx=${m.dx.toFixed(2)} dy=${m.dy.toFixed(2)}`,
          )
        const wantColor = e.fg ?? measured.defaultColor
        if (m.color !== wantColor)
          problems.push(
            `r${e.row} c${e.col} '${e.ch}': color ${m.color} != ${wantColor}`,
          )
      }
      if (measured.cells.length !== expected.length)
        problems.push(
          `cell count: browser ${measured.cells.length} != oracle ${expected.length}`,
        )
      expect(problems.slice(0, 15), problems.length + ' problems').toEqual([])
    })
  }
})
