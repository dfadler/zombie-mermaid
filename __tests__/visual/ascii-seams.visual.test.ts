/**
 * Seam probe — do adjacent line glyphs actually touch in the browser?
 *
 * The geometry oracle (ascii-geometry.visual.test.ts) proves every glyph sits
 * in the right cell; it cannot see whether `─` next to `─` (or `│` above `│`)
 * joins into one continuous line or leaves a hairline gap, which depends on the
 * font's glyph extents and the mockup's line-height. A real terminal draws box
 * characters to fill their cell, so a gap here is a fidelity loss.
 *
 * Method: screenshot the mockup, then for each pair of same-colored adjacent
 * line glyphs sample the pixels straddling their shared edge, on the pixel row
 * (or column) where the stroke actually is, and compare against the stroke's own
 * intensity in the middle of the cell.
 */
import { expect, test } from '@playwright/test'
import { renderMermaidASCII } from '../../src/index.ts'
import { samples } from '../../packages/site/samples-data.ts'
import { TERMINAL_ASCII_OPTS } from './helpers/terminal-panel.ts'
import { mountAndMeasure } from './helpers/ascii-measure.ts'

/** Minimum fraction of the stroke's own intensity that must survive at the seam. */
const MIN_SEAM_RATIO = Number(process.env.SEAM_RATIO ?? 0.9)

interface Probe {
  /** h: ─ next to ─, v: │ above │, b: █ next to █ */
  kind: 'h' | 'v' | 'b'
  row: number
  col: number
  ch: string
}

// Wide enough that no sample scrolls: pixels clipped by the panel's overflow
// would read as a gap at the clip edge.
test.use({ viewport: { width: 3000, height: 1200 } })

// 8 CSS px cells are a whole number of device pixels at these scale factors
// (a 1.1 or 1.75 display would not be, and no CSS can fix that).
const DEVICE_SCALE_FACTORS = [1, 2]

for (const dpr of DEVICE_SCALE_FACTORS) {
  test.describe(`ASCII mockup line seams @${dpr}x`, () => {
    test.use({ deviceScaleFactor: dpr })
    for (const [i, sample] of samples.entries()) {
      if (sample.category === 'Hero') continue
      test(`${i} ${sample.title}`, async ({ page }) => {
        let html: string
        try {
          html = renderMermaidASCII(sample.source, {
            ...TERMINAL_ASCII_OPTS,
            colorMode: 'html',
          })
        } catch {
          test.skip(true, 'no ASCII support for this diagram type')
          return
        }
        const m = await mountAndMeasure(page, html)
        // A scrolling panel screenshots only its visible part; probes beyond
        // it would read background and be skipped without saying so.
        expect(m.clipped, 'mockup panel is clipped horizontally').toBe(false)
        const at = new Map(m.cells.map((c) => [`${c.row},${c.col}`, c]))
        const probes: Probe[] = []
        for (const c of m.cells) {
          const right = at.get(`${c.row},${c.col + 1}`)
          if (c.ch === '─' && right?.ch === '─' && right.color === c.color)
            probes.push({ kind: 'h', row: c.row, col: c.col, ch: c.ch })
          if (c.ch === '█' && right?.ch === '█' && right.color === c.color)
            probes.push({ kind: 'b', row: c.row, col: c.col, ch: c.ch })
          const below = at.get(`${c.row + 1},${c.col}`)
          if (c.ch === '│' && below?.ch === '│' && below.color === c.color)
            probes.push({ kind: 'v', row: c.row, col: c.col, ch: c.ch })
        }
        test.skip(probes.length === 0, 'no adjacent line glyphs')

        const png = await page.screenshot({ fullPage: true })
        const failures = await page.evaluate(
          async ({ b64, probes, m, minRatio }) => {
            const blob = await (
              await fetch('data:image/png;base64,' + b64)
            ).blob()
            const bmp = await createImageBitmap(blob)
            const canvas = new OffscreenCanvas(bmp.width, bmp.height)
            const ctx = canvas.getContext('2d')!
            ctx.drawImage(bmp, 0, 0)
            const data = ctx.getImageData(0, 0, bmp.width, bmp.height).data
            const bgm = /#(..)(..)(..)/.exec(m.background)!
            const bg = [1, 2, 3].map((k) => parseInt(bgm[k]!, 16))
            const dist = (x: number, y: number): number => {
              if (x < 0 || y < 0 || x >= bmp.width || y >= bmp.height) return 0
              const o = (y * bmp.width + x) * 4
              return Math.max(
                Math.abs(data[o]! - bg[0]!),
                Math.abs(data[o + 1]! - bg[1]!),
                Math.abs(data[o + 2]! - bg[2]!),
              )
            }
            const median = (xs: number[]): number =>
              [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0
            const out: string[] = []
            let worst = 1
            for (const p of probes) {
              const x0 = m.originX + p.col * m.cellW
              const y0 = m.originY + p.row * m.lineH
              let ratio: number
              let detail = ''
              if (p.kind === 'b') {
                // fill intensity from the middle of the cell; the seam is the
                // dimmest pixel straddling the shared edge, over the middle rows
                const s = dist(
                  Math.round(x0 + m.cellW / 2),
                  Math.round(y0 + m.lineH / 2),
                )
                if (s < 8) continue
                const xb = Math.round(x0 + m.cellW)
                let lo = s
                for (
                  let y = Math.ceil(y0 + 0.3 * m.lineH);
                  y < y0 + 0.7 * m.lineH;
                  y++
                )
                  lo = Math.min(lo, dist(xb - 1, y), dist(xb, y))
                ratio = lo / s
                detail = ` px[${xb - 2}..${xb + 1}]@mid=${[-2, -1, 0, 1].map((k) => dist(xb + k, Math.round(y0 + m.lineH / 2))).join(',')} s=${s}`
              } else if (p.kind === 'h') {
                // stroke row: brightest pixel row down the middle of the cell
                // stroke row = the row with the highest median intensity across
                // the cell's interior columns, so a stray bright pixel can't win
                const cols: number[] = []
                for (let x = Math.ceil(x0 + 1); x < x0 + m.cellW - 1; x++)
                  cols.push(x)
                let sy = -1
                let s = 0
                // middle band only: the rows above/below can overhang into the
                // cell's first/last pixel row (e.g. a block char's bottom edge)
                for (
                  let y = Math.ceil(y0 + 0.25 * m.lineH);
                  y < y0 + 0.75 * m.lineH;
                  y++
                ) {
                  const d = median(cols.map((x) => dist(x, y)))
                  if (d > s) [s, sy] = [d, y]
                }
                if (s < 8) continue
                const xb = Math.round(x0 + m.cellW)
                const side = (x: number) =>
                  Math.max(dist(x, sy - 1), dist(x, sy), dist(x, sy + 1))
                ratio = Math.min(side(xb - 1), side(xb)) / s
                detail = ` y=${sy} px[${xb - 3}..${xb + 2}]=${[-3, -2, -1, 0, 1, 2].map((k) => dist(xb + k, sy)).join(',')} s=${s}`
              } else {
                const rows: number[] = []
                for (let y = Math.ceil(y0 + 1); y < y0 + m.lineH - 1; y++)
                  rows.push(y)
                let sx = -1
                let s = 0
                for (
                  let x = Math.ceil(x0 + 0.25 * m.cellW);
                  x < x0 + 0.75 * m.cellW;
                  x++
                ) {
                  const d = median(rows.map((y) => dist(x, y)))
                  if (d > s) [s, sx] = [d, x]
                }
                if (s < 8) continue
                const yb = Math.round(y0 + m.lineH)
                const side = (y: number) =>
                  Math.max(dist(sx - 1, y), dist(sx, y), dist(sx + 1, y))
                ratio = Math.min(side(yb - 1), side(yb)) / s
              }
              worst = Math.min(worst, ratio)
              if (ratio < minRatio)
                out.push(
                  `${p.ch} r${p.row} c${p.col}: ${ratio.toFixed(2)} edge@${(p.kind === 'h' ? x0 + m.cellW : y0 + m.lineH).toFixed(2)}${detail}`,
                )
            }
            return { out, worst }
          },
          {
            b64: png.toString('base64'),
            probes,
            // the screenshot is in device pixels; the probe works in them too
            m: {
              ...m,
              cellW: m.cellW * dpr,
              lineH: m.lineH * dpr,
              originX: m.originX * dpr,
              originY: m.originY * dpr,
            },
            minRatio: MIN_SEAM_RATIO,
          },
        )
        test.info().annotations.push({
          type: 'seam',
          description: `${probes.length} probes, worst ratio ${failures.worst.toFixed(2)}`,
        })
        expect(
          failures.out.slice(0, 10),
          `${failures.out.length} seams`,
        ).toEqual([])
      })
    }
  })
}
