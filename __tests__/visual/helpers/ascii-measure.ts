/**
 * Mounts the terminal-window mockup in a Playwright page and measures where
 * Chromium drew every non-space glyph, expressed as terminal cells. Shared by
 * the geometry-oracle and seam-probe tests.
 */
import type { Page } from '@playwright/test'
import { buildHarnessScript } from './build-harness.ts'
import type {} from './harness-types.ts'

export interface MeasuredCell {
  ch: string
  /** column/row derived from the drawn pixel position, not from the text */
  col: number
  row: number
  /** offset (CSS px) of the glyph from its cell's origin */
  dx: number
  dy: number
  /** glyph width in cells */
  w: number
  /** computed color, '#rrggbb' */
  color: string
}

export interface Measured {
  cells: MeasuredCell[]
  cellW: number
  lineH: number
  /** page (CSS px) coordinates of the cell lattice origin */
  originX: number
  originY: number
  defaultColor: string
  /** computed background color of the mockup's <pre> */
  background: string
}

export async function mountAndMeasure(
  page: Page,
  html: string,
): Promise<Measured> {
  await page.setContent('<!DOCTYPE html><html><body></body></html>')
  await page.addScriptTag({ content: await buildHarnessScript() })
  return page.evaluate((html) => {
    const panel = window.__harness.buildTerminalPanel(html)
    void window.__harness.mountAsciiPanel(panel)
    const pre = document.querySelector('.ascii-output') as HTMLElement
    const code = pre.querySelector('code') as HTMLElement
    const cs = getComputedStyle(code)
    const pcs = getComputedStyle(pre)
    const probe = document.createElement('span')
    probe.textContent = '0'.repeat(100)
    code.appendChild(probe)
    const cellW = probe.getBoundingClientRect().width / 100
    probe.remove()
    const lineH = parseFloat(cs.lineHeight)
    const pr = pre.getBoundingClientRect()
    const originX =
      pr.left +
      window.scrollX +
      parseFloat(pcs.paddingLeft) +
      parseFloat(pcs.borderLeftWidth)
    const originY =
      pr.top +
      window.scrollY +
      parseFloat(pcs.paddingTop) +
      parseFloat(pcs.borderTopWidth)
    const toHex = (c: string): string => {
      const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c)
      return m
        ? '#' +
            [m[1], m[2], m[3]]
              .map((n) => Number(n).toString(16).padStart(2, '0'))
              .join('')
        : c
    }
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    const cells: MeasuredCell[] = []
    const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode())) {
      const text = node as Text
      let off = 0
      for (const { segment } of seg.segment(text.data)) {
        if (segment.trim() !== '') {
          const wide = text.parentElement?.classList.contains('ascii-wide')
          let rect: DOMRect
          if (wide && text.parentElement) {
            rect = text.parentElement.getBoundingClientRect()
          } else {
            const r = document.createRange()
            r.setStart(text, off)
            r.setEnd(text, off + segment.length)
            rect = r.getBoundingClientRect()
          }
          const left = rect.left + window.scrollX - originX
          const cy = rect.top + window.scrollY + rect.height / 2 - originY
          const col = Math.round(left / cellW)
          const row = Math.floor(cy / lineH)
          cells.push({
            ch: segment,
            col,
            row,
            dx: left - col * cellW,
            dy: cy - (row + 0.5) * lineH,
            w: rect.width / cellW,
            color: toHex(getComputedStyle(text.parentElement as Element).color),
          })
        }
        off += segment.length
      }
    }
    return {
      cells,
      cellW,
      lineH,
      originX,
      originY,
      defaultColor: toHex(cs.color),
      // the <pre> itself is transparent; the color is painted by an ancestor
      background: (() => {
        for (let el: Element | null = pre; el; el = el.parentElement) {
          const bg = getComputedStyle(el).backgroundColor
          if (!/rgba\(.*, 0\)$|transparent/.test(bg)) return toHex(bg)
        }
        return '#ffffff'
      })(),
    }
  }, html)
}
