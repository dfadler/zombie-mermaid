/**
 * Crispness probe — are vertical box lines drawn as one crisp pixel column?
 *
 * The seam probe checks that adjacent line glyphs join and the legibility probe
 * that they keep clear of text; neither notices a line that has gone soft. A
 * `│` is centred in its cell, so when the cell width is even its stroke centre
 * lands on a pixel boundary and is split across two pixel columns: the line
 * reads blurry and beaded, which a real terminal's crisp one-pixel line does not
 * (an 8px cell measured 1.5x wider than a 7px one, a 9px cell 1.7x).
 *
 * Method: screenshot the mockup; for every isolated `│` in the middle of a
 * vertical run (same-colored `│` above and below, nothing beside it, so no
 * junction ink), take the pixel row through the middle of the cell and compute
 * the stroke's effective width: its total intensity across the cell's interior
 * columns divided by its brightest column, in CSS px. 1.0 is a perfect one-pixel
 * line (anti-aliasing of a ~1px stroke gives a little more); 2.0 is an even
 * split across two pixels. A sample fails when the median over its strokes is
 * above MAX_EFFECTIVE_WIDTH_CSS_PX.
 */
import { expect, test } from '@playwright/test'
import { renderMermaidASCII } from '../../src/index.ts'
import { samples } from '../../packages/site/samples-data.ts'
import { TERMINAL_ASCII_OPTS } from './helpers/terminal-panel.ts'
import { mountAndMeasure } from './helpers/ascii-measure.ts'

/**
 * Highest median effective stroke width, in CSS px, a sample may have.
 * Measured on macOS Chromium (every sample's median is the same to 0.01px, the
 * cell being exact): the 7px cell gives 1.14 at 1x and 1.16 at 2x; an 8px cell
 * 2.00 at 1x and 1.32 at 2x; a 9px cell 1.45-1.48. 1.25 separates them.
 */
const MAX_EFFECTIVE_WIDTH_CSS_PX = Number(process.env.CRISP_MAX_WIDTH ?? 1.25)
/** Fewest isolated strokes a sample needs for its median to mean anything. */
const MIN_STROKES = 3

// Wide enough that no sample scrolls (see ascii-seams.visual.test.ts).
test.use({ viewport: { width: 3000, height: 1200 } })

const DEVICE_SCALE_FACTORS = (process.env.CRISP_DPRS ?? '1,2')
  .split(',')
  .map(Number)

for (const dpr of DEVICE_SCALE_FACTORS) {
  test.describe(`ASCII mockup stroke crispness @${dpr}x`, () => {
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
        expect(m.clipped, 'mockup panel is clipped horizontally').toBe(false)
        const at = new Map(m.cells.map((c) => [`${c.row},${c.col}`, c]))
        const strokes = m.cells.filter((c) => {
          if (c.ch !== '│') return false
          const above = at.get(`${c.row - 1},${c.col}`)
          const below = at.get(`${c.row + 1},${c.col}`)
          const beside =
            at.has(`${c.row},${c.col - 1}`) || at.has(`${c.row},${c.col + 1}`)
          return (
            !beside &&
            above?.ch === '│' &&
            above.color === c.color &&
            below?.ch === '│' &&
            below.color === c.color
          )
        })
        test.skip(
          strokes.length < MIN_STROKES,
          'too few isolated vertical lines',
        )

        const png = await page.screenshot({ fullPage: true })
        const result = await page.evaluate(
          async ({ b64, strokes, m }) => {
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
            const widths: number[] = []
            for (const s of strokes) {
              const x0 = m.originX + s.col * m.cellW
              const y = Math.round(m.originY + (s.row + 0.5) * m.lineH)
              let sum = 0
              let peak = 0
              // interior columns only: the first and last pixel of the cell
              // can hold ink from a neighbouring cell's glyph
              for (let x = Math.ceil(x0 + 1); x < x0 + m.cellW - 1; x++) {
                const d = dist(x, y)
                sum += d
                peak = Math.max(peak, d)
              }
              if (peak < 8) continue
              widths.push(sum / peak)
            }
            widths.sort((a, b) => a - b)
            return { widths }
          },
          {
            b64: png.toString('base64'),
            strokes,
            // the screenshot is in device pixels; the probe works in them too
            m: {
              ...m,
              cellW: m.cellW * dpr,
              lineH: m.lineH * dpr,
              originX: m.originX * dpr,
              originY: m.originY * dpr,
            },
          },
        )
        test.skip(result.widths.length < MIN_STROKES, 'strokes too faint')
        const median =
          result.widths[Math.floor(result.widths.length / 2)]! / dpr
        const worst = result.widths[result.widths.length - 1]! / dpr
        test.info().annotations.push({
          type: 'crispness',
          description: `${result.widths.length} strokes, median ${median.toFixed(2)}px, worst ${worst.toFixed(2)}px`,
        })
        expect(
          median,
          `median effective stroke width ${median.toFixed(2)}px over ${result.widths.length} strokes (max ${MAX_EFFECTIVE_WIDTH_CSS_PX})`,
        ).toBeLessThanOrEqual(MAX_EFFECTIVE_WIDTH_CSS_PX)
      })
    }
  })
}
