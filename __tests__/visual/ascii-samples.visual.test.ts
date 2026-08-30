/**
 * Visual regression suite — ASCII output, rendered as a real terminal
 * would show it.
 *
 * Renders every non-Hero sample in samples-data.ts through the same
 * colorMode 'html' path the live demo uses, wrapped in the demo's actual
 * terminal-window chrome (see helpers/terminal-panel.ts), and
 * screenshot-diffs it. This catches regressions that a plain string
 * comparison of the ASCII output can't: box-drawing characters rendering
 * with gaps at a given font, wide-glyph column padding drifting, a color
 * resolving to the wrong terminal palette entry.
 *
 * A sample whose diagram type has no ASCII support renders the same
 * "(ASCII not supported for this diagram type)" fallback the live demo
 * shows — screenshotting that, rather than skipping the sample, means a
 * type gaining or losing ASCII support shows up as a diff instead of
 * silently changing what this suite covers.
 *
 * Lives at the repo root, not under src/__tests__: see the note at the top
 * of svg-samples.visual.test.ts. Runs under Playwright Test for the same
 * reason documented there.
 *
 * Run with `pnpm test:visual`. Update baselines after an intentional
 * rendering change with `pnpm test:visual:update`, then review the new
 * PNGs under __screenshots__/ before committing them.
 */
import { expect, test } from '@playwright/test'
import { renderMermaidASCII } from '../../src/index.ts'
import { samples } from '../../samples-data.ts'
import { escapeHtml } from '../../demo/format.ts'
import { TERMINAL_ASCII_OPTS } from './helpers/terminal-panel.ts'
import { buildHarnessScript } from './helpers/build-harness.ts'
import type {} from './helpers/harness-types.ts'

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

test.describe('gallery samples (samples-data.ts), ASCII/terminal', () => {
  for (const [i, sample] of samples.entries()) {
    // Hero samples have no ASCII panel in the live demo either — see
    // index.ts's `isHero` branch.
    if (sample.category === 'Hero') continue

    test(`renders ${sample.category ?? 'uncategorized'} / ${sample.title}`, async ({
      page,
    }) => {
      let html: string
      try {
        html = renderMermaidASCII(sample.source, TERMINAL_ASCII_OPTS)
      } catch {
        html = escapeHtml('(ASCII not supported for this diagram type)')
      }

      const harnessScript = await buildHarnessScript()
      await page.setContent('<!DOCTYPE html><html><body></body></html>')
      await page.addScriptTag({ content: harnessScript })

      await page.evaluate((html) => {
        const terminalWindow = window.__harness.buildTerminalPanel(html)
        return window.__harness.mountAsciiPanel(terminalWindow)
      }, html)

      await expect(page.locator('.ascii-panel')).toHaveScreenshot(
        `general-${i}-${slug(sample.category ?? 'uncategorized')}-${slug(sample.title)}.png`,
      )
    })
  }
})
