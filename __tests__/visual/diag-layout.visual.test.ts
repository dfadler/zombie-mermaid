/**
 * TEMPORARY diagnostic — not part of the real suite. Prints computed layout
 * info for the ascii panel mounted standalone (as the real suite mounts it)
 * to find out why CI reports `.ascii-panel` as zero-size/invisible while
 * local runs don't. Delete after diagnosis.
 */
import { expect, test } from '@playwright/test'
import { renderMermaidASCII } from '../../src/index.ts'
import { TERMINAL_ASCII_OPTS } from './helpers/terminal-panel.ts'
import { buildHarnessScript } from './helpers/build-harness.ts'
import type {} from './helpers/harness-types.ts'

test('diag: ascii panel layout', async ({ page }) => {
  const html = renderMermaidASCII('graph TD; A-->B;', TERMINAL_ASCII_OPTS)
  const harnessScript = await buildHarnessScript()
  await page.setContent('<!DOCTYPE html><html><body></body></html>')
  await page.addScriptTag({ content: harnessScript })

  await page.evaluate((html) => {
    const terminalWindow = window.__harness.buildTerminalPanel(html)
    return window.__harness.mountAsciiPanel(terminalWindow)
  }, html)

  const info = await page.evaluate(() => {
    function rectAndStyle(sel: string) {
      const el = document.querySelector(sel)
      if (!el) return { found: false }
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        found: true,
        rect: { w: r.width, h: r.height },
        display: cs.display,
        height: cs.height,
        minHeight: cs.minHeight,
        flex: cs.flex,
        overflow: cs.overflow,
        fontFamily: cs.fontFamily,
      }
    }
    return {
      ascendPanel: rectAndStyle('.ascii-panel'),
      terminalWindow: rectAndStyle('.terminal-window'),
      asciiOutput: rectAndStyle('.ascii-output'),
      bodyRect: document.body.getBoundingClientRect(),
      fontsSize: document.fonts.size,
      fontsStatus: document.fonts.status,
      availableFonts: [...document.fonts].map((f) => `${f.family} ${f.status}`),
      monospaceCheck: document.fonts.check('12px monospace'),
      jetbrainsCheck: document.fonts.check('12px "JetBrains Mono"'),
    }
  })

  console.log('DIAG_LAYOUT_INFO', JSON.stringify(info, null, 2))
  expect(true).toBe(true)
})
