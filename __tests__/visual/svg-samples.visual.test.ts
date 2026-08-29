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

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

describe('gallery samples (samples-data.ts)', () => {
  samples.forEach((sample, i) => {
    it(`renders ${sample.category ?? 'uncategorized'} / ${sample.title}`, async () => {
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
