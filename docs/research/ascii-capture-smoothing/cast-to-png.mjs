// Spike prototype (see README.md): replay a real-PTY asciicast through
// @xterm/headless (real terminal emulation), then rasterise the resulting cell
// grid with Chromium, one absolutely positioned cell per glyph, instead of
// agg's own glyph rasteriser.
//
// Usage: node cast-to-png.mjs <in.cast> <out.png> [font] [size] [dpr]
//
// Limits (spike only): colours other than the default and truecolor are not
// mapped, and there is no auto-crop.
import { readFileSync } from 'node:fs'
import xterm from '@xterm/headless'
import { chromium } from '@playwright/test'

const [
  ,
  ,
  castPath,
  outPath,
  font = 'JetBrains Mono',
  sizeArg = '16',
  dprArg = '2',
] = process.argv
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
    const color = c.isFgRGB()
      ? '#' + c.getFgColor().toString(16).padStart(6, '0')
      : '#cccccc'
    cells.push({ x, y, ch, color, span: c.getWidth() })
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
const ctx = await browser.newContext({
  deviceScaleFactor: Number(dprArg),
  viewport: { width: w, height: h },
})
const page = await ctx.newPage()
await page.setContent(
  `<body style="margin:0;background:#121314"><div style="position:relative;width:${w}px;height:${h}px;font:${size}px '${font}';font-variant-ligatures:none;white-space:pre">${spans}</div></body>`,
)
await page.screenshot({ path: outPath })
await browser.close()
console.log('wrote', outPath, `${w}x${h} @${dprArg}x`)
