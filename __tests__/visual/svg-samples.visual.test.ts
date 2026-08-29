/**
 * Visual regression suite — SVG output.
 *
 * Renders every sample in samples-data.ts (the general gallery: every
 * supported shape, edge type, block construct, and theme variant) and
 * xychart-samples-data.ts (deep XY-chart styling coverage), mounts each
 * one in a real Chromium page, and screenshot-diffs it against a
 * committed baseline. A rendering regression that only shows up visually —
 * a clipped label, a broken viewBox, a color that resolves wrong — fails
 * this even when the SVG string itself still parses and the unit suite
 * stays green.
 *
 * Runs under Playwright Test, not Vitest: rendering (renderMermaidSVG)
 * happens here in Node, and only DOM mounting runs in the browser, via the
 * bundled harness (see helpers/build-harness.ts) — there's no Node<->browser
 * RPC bridge for a hung tester to get stuck on, unlike Vitest's browser
 * mode (vitest-dev/vitest#10791, still open; see zombie-mermaid#299 for why
 * this suite moved off it).
 *
 * Lives at the repo root, not under src/__tests__: it imports samples-data.ts
 * and xychart-samples-data.ts, which sit outside tsconfig's `rootDir: "src"`
 * (same reasoning as __tests__/demo-format.test.ts).
 *
 * Run with `pnpm test:visual`. Update baselines after an intentional
 * rendering change with `pnpm test:visual:update`, then review the new
 * PNGs under __screenshots__/ before committing them.
 */
import { expect, test } from '@playwright/test'
import { renderMermaidSVG } from '../../src/index.ts'
import { samples } from '../../samples-data.ts'
import { xychartSamples } from '../../xychart-samples-data.ts'
import { buildHarnessScript } from './helpers/build-harness.ts'
import type {} from './helpers/harness-types.ts'

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

test.describe('gallery samples (samples-data.ts)', () => {
  for (const [i, sample] of samples.entries()) {
    test(`renders ${sample.category ?? 'uncategorized'} / ${sample.title}`, async ({
      page,
    }) => {
      const harnessScript = await buildHarnessScript()
      await page.setContent('<!DOCTYPE html><html><body></body></html>')
      await page.addScriptTag({ content: harnessScript })

      const svg = renderMermaidSVG(sample.source, sample.options)
      const bg = sample.options?.bg
      await page.evaluate(
        ([svg, bg]) => window.__harness.mountSvgPanel(svg, bg),
        [svg, bg] as [string, string | undefined],
      )

      await expect(page.locator('.svg-panel')).toHaveScreenshot(
        `general-${i}-${slug(sample.category ?? 'uncategorized')}-${slug(sample.title)}.png`,
      )
    })
  }
})

test.describe('xychart samples (xychart-samples-data.ts)', () => {
  for (const [i, sample] of xychartSamples.entries()) {
    test(`renders ${sample.category ?? 'uncategorized'} / ${sample.title}`, async ({
      page,
    }) => {
      const harnessScript = await buildHarnessScript()
      await page.setContent('<!DOCTYPE html><html><body></body></html>')
      await page.addScriptTag({ content: harnessScript })

      const svg = renderMermaidSVG(sample.source)
      await page.evaluate((svg) => window.__harness.mountSvgPanel(svg), svg)

      await expect(page.locator('.svg-panel')).toHaveScreenshot(
        `xychart-${i}-${slug(sample.category ?? 'uncategorized')}-${slug(sample.title)}.png`,
      )
    })
  }
})
