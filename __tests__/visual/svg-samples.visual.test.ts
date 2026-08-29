/**
 * Visual regression suite — SVG output.
 *
 * Renders every sample in samples-data.ts (the general gallery: every
 * supported shape, edge type, block construct, and theme variant) and
 * xychart-samples-data.ts (deep XY-chart styling coverage) in a real
 * Chromium tab and screenshot-diffs each one against a committed baseline.
 * A rendering regression that only shows up visually — a clipped label, a
 * broken viewBox, a color that resolves wrong — fails this even when the
 * SVG string itself still parses and the unit suite stays green.
 *
 * Lives at the repo root, not under src/__tests__: it imports samples-data.ts
 * and xychart-samples-data.ts, which sit outside tsconfig's `rootDir: "src"`
 * (same reasoning as __tests__/demo-format.test.ts).
 *
 * Run with `pnpm test:visual`. Update baselines after an intentional
 * rendering change with `pnpm test:visual:update`, then review the new
 * PNGs under __screenshots__/ before committing them.
 */
import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { renderMermaidSVG } from '../../src/index.ts'
import { samples } from '../../samples-data.ts'
import { xychartSamples } from '../../xychart-samples-data.ts'
import { mountSvgPanel, unmount } from './helpers/mount.ts'

// TEMPORARY diagnostic instrumentation for a CI-only hang under
// investigation (browser launches and connects to Vitest's dev server, then
// goes silent — see vitest-dev/vitest#10791). This console.log is forwarded
// through Playwright's console-event bridge into the CI job log the moment
// the browser evaluates this module, distinguishing "the browser never even
// loaded the test file" from "it loaded but something inside a test hung."
// Remove once the hang is understood.
console.log('[diagnostic] svg-samples.visual.test.ts module evaluated')

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

let loggedFirstTestStart = false

describe('gallery samples (samples-data.ts)', () => {
  samples.forEach((sample, i) => {
    it(`renders ${sample.category ?? 'uncategorized'} / ${sample.title}`, async () => {
      if (!loggedFirstTestStart) {
        loggedFirstTestStart = true
        // TEMPORARY diagnostic — see the module-scope comment above.
        console.log(
          '[diagnostic] svg-samples.visual.test.ts first test started',
        )
      }
      const svg = renderMermaidSVG(sample.source, sample.options)
      const panel = await mountSvgPanel(svg, sample.options?.bg)
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

describe('xychart samples (xychart-samples-data.ts)', () => {
  xychartSamples.forEach((sample, i) => {
    it(`renders ${sample.category ?? 'uncategorized'} / ${sample.title}`, async () => {
      const svg = renderMermaidSVG(sample.source)
      const panel = await mountSvgPanel(svg)
      try {
        await expect(page.elementLocator(panel)).toMatchScreenshot(
          `xychart/${i}-${slug(sample.category ?? 'uncategorized')}-${slug(sample.title)}`,
        )
      } finally {
        unmount(panel)
      }
    })
  })
})
