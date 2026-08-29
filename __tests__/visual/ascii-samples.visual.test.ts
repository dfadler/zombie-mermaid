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
 * of svg-samples.visual.test.ts.
 *
 * Run with `pnpm test:visual`. Update baselines after an intentional
 * rendering change with `pnpm test:visual:update`, then review the new
 * PNGs under __screenshots__/ before committing them.
 */
import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { renderMermaidASCII } from '../../src/index.ts'
import { samples } from '../../samples-data.ts'
import { escapeHtml } from '../../demo/format.ts'
import {
  buildTerminalPanel,
  TERMINAL_ASCII_OPTS,
} from './helpers/terminal-panel.ts'
import { mountAsciiPanel, unmount } from './helpers/mount.ts'

// TEMPORARY diagnostic instrumentation — see the matching comment in
// svg-samples.visual.test.ts. Remove once the CI hang is understood.
console.log('[diagnostic] ascii-samples.visual.test.ts module evaluated')

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

let loggedFirstTestStart = false

describe('gallery samples (samples-data.ts), ASCII/terminal', () => {
  samples.forEach((sample, i) => {
    // Hero samples have no ASCII panel in the live demo either — see
    // index.ts's `isHero` branch.
    if (sample.category === 'Hero') return

    it(`renders ${sample.category ?? 'uncategorized'} / ${sample.title}`, async () => {
      if (!loggedFirstTestStart) {
        loggedFirstTestStart = true
        // TEMPORARY diagnostic — see the module-scope comment above.
        console.log(
          '[diagnostic] ascii-samples.visual.test.ts first test started',
        )
      }
      let html: string
      try {
        html = renderMermaidASCII(sample.source, TERMINAL_ASCII_OPTS)
      } catch {
        html = escapeHtml('(ASCII not supported for this diagram type)')
      }
      const terminalWindow = buildTerminalPanel(html)
      const panel = await mountAsciiPanel(terminalWindow)
      try {
        await expect(page.elementLocator(panel)).toMatchScreenshot(
          `general/${i}-${slug(sample.category ?? 'uncategorized')}-${slug(sample.title)}`,
        )
      } finally {
        unmount(panel)
      }
    })
  })
})
