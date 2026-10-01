// Rasterises a real-PTY asciicast to a PNG with Chromium instead of agg.
//
// The recording is replayed through @xterm/headless (real terminal emulation:
// cursor motion, wrapping, wide cells), and the resulting cell grid is drawn
// with one absolutely positioned cell per glyph. agg draws a box junction's
// horizontal arm (`┼`, `├`) a pixel or more off the plain `─` bar, which shows
// up as a step wherever an edge crosses a frame wall; Chromium aligns them (see
// docs/research/ascii-capture-smoothing/README.md).
//
// Backs `ASCII_RASTERISER=chromium` in scripts/ascii-terminal-capture.sh.
//
// Usage: node scripts/ascii-cast-to-png.mjs <in.cast> <out.png> [font] [size] [dpr]
import { readFileSync } from 'node:fs'
import xterm from '@xterm/headless'
import { chromium } from '@playwright/test'

// agg's github-dark theme, so the two rasterisers' PNGs are comparable.
const BG = '#171b21'
const FG = '#eceff4'
const ANSI16 = [
  '#484f58',
  '#ff7b72',
  '#3fb950',
  '#d29922',
  '#58a6ff',
  '#bc8cff',
  '#39c5cf',
  '#b1bac4',
  '#6e7681',
  '#ffa198',
  '#56d364',
  '#e3b341',
  '#79c0ff',
  '#d2a8ff',
  '#56d4dd',
  '#f0f6fc',
]

const [
  ,
  ,
  castPath,
  outPath,
  font = 'JetBrains Mono',
  sizeArg = '16',
  dprArg = '2',
] = process.argv
if (!castPath || !outPath) {
  console.error(
    'usage: ascii-cast-to-png.mjs <in.cast> <out.png> [font] [size] [dpr]',
  )
  process.exit(2)
}

const lines = readFileSync(castPath, 'utf8').split('\n').filter(Boolean)
const head = JSON.parse(lines[0])
// asciicast v2 puts the size at the top level; v3 nests it under `term`.
const cols = head.width ?? head.term.cols
const rows = head.height ?? head.term.rows

const term = new xterm.Terminal({ cols, rows, allowProposedApi: true })
for (const l of lines.slice(1)) {
  const ev = JSON.parse(l)
  if (ev[1] === 'o') await new Promise((done) => term.write(ev[2], done))
}

/** CSS colour for a palette index: 0-15 themed, 16-231 colour cube, 232-255 greys. */
function paletteColor(i) {
  if (i < 16) return ANSI16[i]
  if (i >= 232) {
    const v = 8 + (i - 232) * 10
    return `rgb(${v},${v},${v})`
  }
  const n = i - 16
  const level = (k) => (k === 0 ? 0 : 55 + k * 40)
  return `rgb(${level(Math.floor(n / 36))},${level(Math.floor(n / 6) % 6)},${level(n % 6)})`
}

function fgOf(cell) {
  if (cell.isFgRGB())
    return '#' + cell.getFgColor().toString(16).padStart(6, '0')
  if (cell.isFgPalette()) return paletteColor(cell.getFgColor())
  return FG
}

const size = Number(sizeArg)
const cellW = size * 0.6
const cellH = Math.round(size * 1.4)
const buf = term.buffer.active
const cells = []
let maxCol = 0
let maxRow = 0
for (let y = 0; y < rows; y++) {
  const line = buf.getLine(y)
  if (!line) continue
  for (let x = 0; x < cols; x++) {
    const c = line.getCell(x)
    const ch = c?.getChars()
    if (!c || !ch || ch === ' ') continue
    cells.push({ x, y, ch, color: fgOf(c), span: c.getWidth() })
    maxCol = Math.max(maxCol, x + c.getWidth() - 1)
    maxRow = Math.max(maxRow, y)
  }
}

const pad = 8
const w = Math.ceil((maxCol + 1) * cellW) + pad * 2
const h = (maxRow + 1) * cellH + pad * 2
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const spans = cells
  .map(
    (c) =>
      `<span style="position:absolute;left:${pad + c.x * cellW}px;top:${pad + c.y * cellH}px;width:${c.span * cellW}px;height:${cellH}px;line-height:${cellH}px;color:${c.color}">${esc(c.ch)}</span>`,
  )
  .join('')

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({
    deviceScaleFactor: Number(dprArg),
    viewport: { width: w, height: h },
  })
  const page = await ctx.newPage()
  await page.setContent(
    `<body style="margin:0;background:${BG}"><div style="position:relative;width:${w}px;height:${h}px;font:${size}px '${font}';font-variant-ligatures:none;white-space:pre">${spans}</div></body>`,
  )
  await page.screenshot({ path: outPath })
} finally {
  await browser.close()
}
