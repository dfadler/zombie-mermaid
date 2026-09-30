/**
 * Legibility probe — does text stay readable where a connector runs into it?
 *
 * The renderer interrupts a connector where a label sits on it (e.g. the `t`
 * of "West" takes the connector's cell in "US West Region"), so a line ends
 * directly above and below the text. A terminal draws the line to the cell
 * edge and the text inside the cell, leaving a small gap. In the mockup the
 * gap depends on line-height: JetBrains Mono's box glyphs are ~1.32em tall, so
 * a row that is too short makes them overshoot into the text row and touch the
 * glyph ("Wes|t"). The seam probe wants rows short enough to join; this wants
 * them tall enough to keep clear of text; together they bound line-height.
 *
 * Method: wrap every glyph as either box-drawing (U+2500-257F) or other, then
 * screenshot a small clip around each pair twice, once with only box glyphs
 * visible and once with only the rest. That separates line ink from text ink
 * geometrically, so it works whatever the colors are. For each vertical-stub
 * box glyph directly above or below a letter or digit, measure the blank gap
 * between the line's last ink row (in its stroke column) and the text's nearest
 * ink row, and require it to be at least MIN_GAP_CSS_PX. A negative gap means
 * they overlap.
 *
 * Runs at 8x device scale, clipped to the pair: at 1x both edges are
 * anti-aliased to whole pixels, so a real ~1.6px gap can read as 0 (measured on
 * "Sequence: Loop Block", a `p` descender above a lifeline). 8x gives ~0.125px
 * resolution and is close to the glyphs' true geometry.
 */
import { expect, test } from '@playwright/test'
import { renderMermaidASCII } from '../../src/index.ts'
import { samples } from '../../packages/site/samples-data.ts'
import { TERMINAL_ASCII_OPTS } from './helpers/terminal-panel.ts'
import { mountAndMeasure } from './helpers/ascii-measure.ts'

/**
 * Minimum blank gap between a line's ink and adjacent text ink, in CSS px.
 * Measured over the 212 connector/text pairs in the samples: `main`'s original
 * CSS (6.72x14.56px cell, line-height 1.3) had a median gap of 2.4px and a
 * worst of 0.75px for text without a descender; the 15px-row regression this
 * guards against had a median of 0.1px and overlapped by up to 0.75px.
 */
const MIN_GAP_CSS_PX = 1
/**
 * A descender letter (g j p q y) directly above a line reaches the bottom of
 * its cell, where the line starts, so it touches or slightly overlaps by
 * design: `main`'s original CSS measured -0.5px for these (3 pairs in the
 * samples). Require no worse than that.
 */
const MIN_GAP_DESCENDER_ABOVE_LINE_CSS_PX = -0.5
const DPR = 8

const DOWN_STUB = new Set(['│', '┼', '├', '┤', '┬', '┌', '┐'])
const UP_STUB = new Set(['│', '┼', '├', '┤', '┴', '└', '┘'])
const TEXT = /^[\p{L}\p{N}]$/u

interface Probe {
  /** 'down': line in the row above the text. 'up': line in the row below. */
  kind: 'down' | 'up'
  row: number
  col: number
  ch: string
  textCh: string
  lineColor: string
  textColor: string
}

test.use({
  viewport: { width: 3000, height: 1200 },
  deviceScaleFactor: DPR,
})

test.describe('ASCII mockup text legibility', () => {
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
      const probes: Probe[] = []
      for (const c of m.cells) {
        const below = at.get(`${c.row + 1},${c.col}`)
        if (below && c.w < 1.5 && below.w < 1.5) {
          if (DOWN_STUB.has(c.ch) && TEXT.test(below.ch))
            probes.push({
              kind: 'down',
              row: c.row,
              col: c.col,
              ch: c.ch,
              textCh: below.ch,
              lineColor: c.color,
              textColor: below.color,
            })
          if (TEXT.test(c.ch) && UP_STUB.has(below.ch))
            probes.push({
              kind: 'up',
              row: c.row,
              col: c.col,
              ch: below.ch,
              textCh: c.ch,
              lineColor: below.color,
              textColor: c.color,
            })
        }
      }
      test.skip(probes.length === 0, 'no connector next to text')

      // Wrap every glyph as a box-drawing glyph (.lg-l) or other (.lg-t).
      // Inline spans do not change a monospace glyph's advance, so layout
      // (and the measured cells) is unchanged.
      await page.evaluate(() => {
        const code = document.querySelector('.ascii-output code')!
        const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT)
        const nodes: Text[] = []
        let n: Node | null
        while ((n = walker.nextNode())) nodes.push(n as Text)
        const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        for (const t of nodes) {
          if (t.parentElement?.classList.contains('ascii-wide')) continue
          const frag = document.createDocumentFragment()
          for (const { segment } of seg.segment(t.data)) {
            if (segment.trim() === '') {
              frag.appendChild(document.createTextNode(segment))
              continue
            }
            const span = document.createElement('span')
            const cp = segment.codePointAt(0)!
            span.className = cp >= 0x2500 && cp <= 0x257f ? 'lg-l' : 'lg-t'
            span.textContent = segment
            frag.appendChild(span)
          }
          t.replaceWith(frag)
        }
      })

      // CSS-px geometry of each probe and the small clip around it
      const geo = probes.map((p) => {
        const x0 = m.originX + p.col * m.cellW
        const lineRow = p.kind === 'down' ? p.row : p.row + 1
        const textRow = p.kind === 'down' ? p.row + 1 : p.row
        const yLine0 = m.originY + lineRow * m.lineH
        const yText0 = m.originY + textRow * m.lineH
        const top = Math.max(0, Math.min(yLine0, yText0) - 3)
        const left = Math.max(0, x0 - m.cellW)
        return {
          x0,
          yLine0,
          yText0,
          lineRow,
          clip: {
            x: left,
            y: top,
            width: 3 * m.cellW,
            height: 2 * m.lineH + 6,
          },
        }
      })
      const layer = async (hide: string): Promise<string[]> => {
        const style = await page.addStyleTag({
          content: `${hide}{color:transparent!important}`,
        })
        const shots: string[] = []
        for (const g of geo)
          shots.push(
            (await page.screenshot({ clip: g.clip })).toString('base64'),
          )
        await style.evaluate((el) => el.remove())
        return shots
      }
      const linesOnly = await layer('.lg-t')
      const textOnly = await layer('.lg-l')

      const result = await page.evaluate(
        async ({
          linesOnly,
          textOnly,
          probes,
          geo,
          m,
          minGap,
          minGapDescender,
          dpr,
        }) => {
          const load = async (b64: string) => {
            const blob = await (
              await fetch('data:image/png;base64,' + b64)
            ).blob()
            const bmp = await createImageBitmap(blob)
            const canvas = new OffscreenCanvas(bmp.width, bmp.height)
            const ctx = canvas.getContext('2d')!
            ctx.drawImage(bmp, 0, 0)
            return {
              w: bmp.width,
              h: bmp.height,
              d: ctx.getImageData(0, 0, bmp.width, bmp.height).data,
            }
          }
          const rgb = (hex: string): number[] => {
            const g = /#(..)(..)(..)/.exec(hex)!
            return [1, 2, 3].map((k) => parseInt(g[k]!, 16))
          }
          const bg = rgb(m.background)
          const nominal = (hex: string): number => {
            const c = rgb(hex)
            return Math.max(
              Math.abs(c[0]! - bg[0]!),
              Math.abs(c[1]! - bg[1]!),
              Math.abs(c[2]! - bg[2]!),
            )
          }
          const median = (xs: number[]): number =>
            [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0

          let evaluated = 0
          let skipped = 0
          const reasons: string[] = []
          let worst = Infinity
          const out: string[] = []
          for (const [k, p] of probes.entries()) {
            const g = geo[k]!
            const A = await load(linesOnly[k]!)
            const B = await load(textOnly[k]!)
            const dist = (img: typeof A, x: number, y: number): number => {
              if (x < 0 || y < 0 || x >= img.w || y >= img.h) return 0
              const o = (y * img.w + x) * 4
              return Math.max(
                Math.abs(img.d[o]! - bg[0]!),
                Math.abs(img.d[o + 1]! - bg[1]!),
                Math.abs(img.d[o + 2]! - bg[2]!),
              )
            }
            const nomLine = nominal(p.lineColor)
            const nomText = nominal(p.textColor)
            if (nomLine < 8 || nomText < 8) {
              skipped++
              reasons.push('invisible')
              continue
            }
            // clip-local device coordinates
            const lx = (css: number): number => (css - g.clip.x) * dpr
            const ly = (css: number): number => (css - g.clip.y) * dpr
            const cellW = m.cellW * dpr
            const lineH = m.lineH * dpr
            const x0 = lx(g.x0)
            const yLine0 = ly(g.yLine0)
            const yText0 = ly(g.yText0)

            // stroke column: highest median line ink down the line cell
            const rows: number[] = []
            for (let y = Math.ceil(yLine0 + dpr); y < yLine0 + lineH - dpr; y++)
              rows.push(y)
            let sx = -1
            let best = 0
            for (
              let x = Math.ceil(x0 + 0.25 * cellW);
              x < x0 + 0.75 * cellW;
              x++
            ) {
              const d = median(rows.map((y) => dist(A, x, y)))
              if (d > best) [best, sx] = [d, x]
            }
            if (best < 0.5 * nomLine) {
              skipped++
              reasons.push('no-stroke')
              continue
            }

            // last line-ink row toward the text, from the middle of the cell
            const step = p.kind === 'down' ? 1 : -1
            let end = Math.round(yLine0 + lineH / 2)
            for (
              let y = end;
              y >= 0 && y < A.h && dist(A, sx, y) >= 0.5 * nomLine;
              y += step
            )
              end = y

            // nearest text-ink row: scan the text row (plus slack either side)
            // across the text cell's columns, from the line side outward
            let textEdge: number | null = null
            const x1 = Math.floor(x0)
            const x2 = Math.ceil(x0 + cellW)
            const lo = Math.max(0, Math.floor(yText0 - 2 * dpr))
            const hi = Math.min(B.h, Math.ceil(yText0 + lineH + 2 * dpr))
            const start = p.kind === 'down' ? lo : hi - 1
            for (
              let y = start;
              y >= lo && y < hi && textEdge === null;
              y += step
            )
              for (let x = x1; x < x2; x++)
                if (dist(B, x, y) >= 0.5 * nomText) {
                  textEdge = y
                  break
                }
            if (textEdge === null) {
              skipped++
              reasons.push('no-text-ink')
              continue
            }
            const gapCss = ((textEdge - end) * step - 1) / dpr
            evaluated++
            worst = Math.min(worst, gapCss)
            const limit =
              p.kind === 'up' && /[gjpqy]/.test(p.textCh)
                ? minGapDescender
                : minGap
            if (gapCss < limit)
              out.push(
                `${p.ch} r${g.lineRow} c${p.col} vs '${p.textCh}': gap ${gapCss.toFixed(2)}px (< ${limit})`,
              )
          }
          return { out, evaluated, skipped, worst, reasons }
        },
        {
          linesOnly,
          textOnly,
          probes,
          geo,
          m,
          minGap: MIN_GAP_CSS_PX,
          minGapDescender: MIN_GAP_DESCENDER_ABOVE_LINE_CSS_PX,
          dpr: DPR,
        },
      )
      test.info().annotations.push({
        type: 'legibility',
        description: `${result.evaluated} evaluated, ${result.skipped} skipped, worst gap ${result.worst.toFixed(2)}px`,
      })
      expect(
        result.evaluated,
        `no connector/text pair could be evaluated (${result.skipped} skipped: ${result.reasons.join(', ')})`,
      ).toBeGreaterThan(0)
      expect(result.out.slice(0, 10), `${result.out.length} tight`).toEqual([])
    })
  }
})
