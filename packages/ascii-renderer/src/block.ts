// ============================================================================
// ASCII renderer — Block diagrams
//
// Mermaid has no text mode for block diagrams, so there is no reference output
// to match. The SVG is a grid, and a grid has a direct text form: every block
// is a box, all boxes in a group share one cell size (the widest label, a
// block spanning N columns counting 1/N of its width), cells fill left to right
// in `columns` columns, and a `block ... end` group is a larger box around its
// cells:
//
//   ┌───────┐ ┌───────────────────┐
//   │   a   │ │         b         │
//   └───────┘ └───────────────────┘
//   ┌─────────────────────────────┐
//   │ ┌───────┐         ┌───────┐ │
//   │ │   c   │         │   d   │ │
//   │ └───────┘         └───────┘ │
//   └─────────────────────────────┘
//
//   - Round blocks use rounded corners (Unicode only; ASCII keeps `+`).
//   - `space` leaves its cell empty.
//   - Cells are one column apart and touch vertically.
//   - Frames are painted in the line colour, labels in the foreground.
//   - Widths are display widths (CJK and emoji labels line up).
// ============================================================================

import { parseBlock } from '@zombie-mermaid/mermaid-parser'
import type { BlockNode } from '@zombie-mermaid/mermaid-parser'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { colorizeText } from './ansi.ts'
import { displayWidth } from './display-width.ts'

const UNI = { h: '─', v: '│', tl: '┌', tr: '┐', bl: '└', br: '┘', rtl: '╭', rtr: '╮', rbl: '╰', rbr: '╯' }
const ASC = { h: '-', v: '|', tl: '+', tr: '+', bl: '+', br: '+', rtl: '+', rtr: '+', rbl: '+', rbr: '+' }

/** Columns between neighbouring cells. */
const GAP = 1
/** Columns between a group's frame and its cells. */
const INSET = 1

/** One screen cell: a glyph (`''` for the second half of a wide one) and its paint. */
interface Cell {
  s: string
  line: boolean
}
type Canvas = Cell[][]

const blank = (w: number, h: number): Canvas =>
  Array.from({ length: h }, () =>
    Array.from({ length: w }, () => ({ s: ' ', line: false })),
  )

const labelLines = (label: string): string[] =>
  label.split(/<br\s*\/?>/i).map((l) => l.replace(/\s+/g, ' ').trim())

interface Size {
  w: number
  h: number
}

/** Number of columns a group lays its children in, and its rows. */
function gridOf(node: BlockNode): { xSize: number; ySize: number } {
  const items = node.children.reduce((n, c) => n + c.widthInColumns, 0)
  let xSize = node.children.length
  const columns = node.columns ?? -1
  if (columns > 0 && columns < items) xSize = columns
  return { xSize: Math.max(1, xSize), ySize: Math.ceil(items / Math.max(1, xSize)) }
}

/** Natural size of a node's box. */
function measure(node: BlockNode, root = false): Size {
  if (node.type === 'node') {
    const lines = labelLines(node.label)
    return {
      w: Math.max(0, ...lines.map(displayWidth)) + 4,
      h: lines.length + 2,
    }
  }
  const { xSize, ySize } = gridOf(node)
  let cw = 0
  let ch = 0
  for (const c of node.children) {
    if (c.type === 'space') continue
    const s = measure(c)
    cw = Math.max(cw, Math.ceil((s.w + GAP) / c.widthInColumns) - GAP)
    ch = Math.max(ch, s.h)
  }
  const inset = root ? 0 : INSET + 1
  return {
    w: xSize * cw + (xSize - 1) * GAP + 2 * inset,
    h: ySize * ch + (root ? 0 : 2),
  }
}

/** Draw `node` into `canvas` with its top-left at (x, y), `size` wide and tall. */
function draw(
  canvas: Canvas,
  node: BlockNode,
  x: number,
  y: number,
  size: Size,
  g: typeof UNI,
  root = false,
): void {
  const put = (cx: number, cy: number, s: string, line: boolean): void => {
    const row = canvas[cy]
    if (row?.[cx] !== undefined) row[cx] = { s, line }
  }
  if (!root) {
    const round = node.type === 'node' && node.shape === 'round'
    const { w, h } = size
    put(x, y, round ? g.rtl : g.tl, true)
    put(x + w - 1, y, round ? g.rtr : g.tr, true)
    put(x, y + h - 1, round ? g.rbl : g.bl, true)
    put(x + w - 1, y + h - 1, round ? g.rbr : g.br, true)
    for (let i = 1; i < w - 1; i++) {
      put(x + i, y, g.h, true)
      put(x + i, y + h - 1, g.h, true)
    }
    for (let j = 1; j < h - 1; j++) {
      put(x, y + j, g.v, true)
      put(x + w - 1, y + j, g.v, true)
    }
  }
  if (node.type === 'node') {
    const lines = labelLines(node.label)
    const top = y + 1 + Math.floor((size.h - 2 - lines.length) / 2)
    lines.forEach((text, k) => {
      const left = x + 1 + Math.floor((size.w - 2 - displayWidth(text)) / 2)
      let cx = left
      for (const ch of text) {
        const dw = displayWidth(ch)
        put(cx, top + k, ch, false)
        if (dw === 2) put(cx + 1, top + k, '', false)
        cx += dw
      }
    })
    return
  }

  const { xSize, ySize } = gridOf(node)
  const inset = root ? 0 : INSET + 1
  const innerW = size.w - 2 * inset
  const innerH = size.h - (root ? 0 : 2)
  const cw = Math.floor((innerW - (xSize - 1) * GAP) / xSize)
  const ch = Math.floor(innerH / ySize)
  const columns = node.columns ?? -1
  let pos = 0
  for (const child of node.children) {
    const px = columns > 0 ? pos % columns : pos
    const py = columns > 0 ? Math.floor(pos / columns) : 0
    const span = Math.min(
      child.widthInColumns,
      columns > 0 ? columns - px : child.widthInColumns,
    )
    if (child.type !== 'space') {
      const w = cw * child.widthInColumns + (child.widthInColumns - 1) * GAP
      draw(
        canvas,
        child,
        x + inset + px * (cw + GAP),
        y + (root ? 0 : 1) + py * ch,
        { w, h: ch },
        g,
      )
    }
    pos += span
  }
}

export function renderBlockAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const diagram = parseBlock(text)
  const g = config.useAscii ? ASC : UNI
  const size = measure(diagram.root, true)
  if (size.w <= 0 || size.h <= 0) return ''
  const canvas = blank(size.w, size.h)
  draw(canvas, diagram.root, 0, 0, size, g, true)

  return canvas
    .map((row0) => {
      let end = row0.length
      while (end > 0 && row0[end - 1]!.s === ' ') end--
      const row = row0.slice(0, end)
      let out = ''
      let run = ''
      let runLine = false
      const flush = () => {
        if (run !== '')
          out += colorizeText(run, runLine ? theme.line : theme.fg, colorMode)
        run = ''
      }
      for (const cell of row) {
        if (cell.line !== runLine) {
          flush()
          runLine = cell.line
        }
        run += cell.s
      }
      flush()
      return out
    })
    .join('\n')
}
