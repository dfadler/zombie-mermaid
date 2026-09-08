/**
 * Generates index.html showcasing all zombie-mermaid rendering capabilities.
 *
 * Usage: tsx index.ts
 *
 * This file doubles as a **visual test suite** — every supported feature,
 * shape, edge type, block construct, and theme variant is exercised by at
 * least one sample. If a rendering change causes regressions, it will be
 * visible in the generated HTML.
 *
 * The generated HTML is **dynamic** — it includes a bundled copy of the
 * mermaid renderer and renders all diagrams client-side in real time,
 * showing progressive loading and per-diagram render timing.
 *
 * Sample definitions live in samples-data.ts (shared with bench.ts).
 *
 * The markup comes from React components (demo/components/index-page.tsx)
 * rendered with react-dom/server's `renderToStaticMarkup` — part of #589,
 * which moved every site generator off template-literal HTML. This file
 * keeps the I/O and the build steps (stylesheet, JSON-LD, the two browser
 * bundles, shiki highlighting) and hands the results to the components.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { createElement } from 'react'
import {
  formatDescription,
  escapeJsonForScriptTag,
  buildSoftwareApplicationJsonLd,
  type SoftwareApplicationPackageInfo,
} from './demo/format.ts'
import { renderHtmlDocument } from './demo/render-html.ts'
import {
  IndexPage,
  type CategorySection,
  type HeroCard,
  type SampleCard,
} from './demo/components/index-page.tsx'
import { bundleForBrowser } from './scripts/vite-bundle.ts'
import { samples } from './samples-data.ts'
import { createHighlighter } from 'shiki'

/**
 * Load the demo stylesheet and re-indent it for inlining inside `<style>`.
 *
 * The stylesheet lives in `demo/styles.css` as a normal file so stylelint,
 * prettier, and editor tooling can see it — it used to be an ~1000-line
 * template literal, which none of them could. Re-indenting on the way in
 * keeps the emitted HTML byte-identical to the template-literal version.
 */
async function loadStyles(): Promise<string> {
  const css = await readFile(
    new URL('./demo/styles.css', import.meta.url),
    'utf8',
  )
  return css
    .replace(/\n+$/, '')
    .split('\n')
    .map((line) => (line === '' ? '' : `    ${line}`))
    .join('\n')
}

/**
 * Bundle `demo/client.ts` for the browser.
 *
 * Mirrors how `src/browser.ts` is bundled, except unminified: the emitted
 * page should stay readable in devtools, which the hand-written version was.
 */
async function bundleClientScript(): Promise<string> {
  return bundleForBrowser(
    new URL('./demo/client.ts', import.meta.url).pathname,
    {
      minify: false,
    },
  )
}

/**
 * Read package.json and build the `SoftwareApplication` JSON-LD block for
 * the demo site's `<head>`, indented and escaped for embedding in a
 * `<script type="application/ld+json">` tag.
 *
 * The I/O (reading package.json) lives here; the JSON-LD shape itself is
 * `buildSoftwareApplicationJsonLd` in demo/format.ts, which is pure and unit
 * tested directly — see that function's doc comment for why the block is
 * shaped the way it is.
 */
async function buildJsonLd(): Promise<string> {
  const pkgRaw = await readFile(
    new URL('./package.json', import.meta.url),
    'utf8',
  )
  const pkg = JSON.parse(pkgRaw) as SoftwareApplicationPackageInfo
  const jsonLd = buildSoftwareApplicationJsonLd(pkg)

  const json = escapeJsonForScriptTag(JSON.stringify(jsonLd, null, 2))
  return json
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n')
}

// ============================================================================
// HTML generation — dynamic version
//
// Instead of pre-rendering SVGs at build time, we:
//   1. Bundle the mermaid renderer for the browser via Vite's build() API
//   2. Embed sample definitions as inline JSON
//   3. Emit client-side JS that renders each diagram on page load
// ============================================================================

/** URL/id-safe slug for a category name, e.g. "XY Chart" -> "xy-chart". */
function slugifyCategory(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * Category-name prefixes stripped from sidebar entries.
 *
 * Sample titles carry their category ("Sequence: Basic Flow") so they read
 * standalone elsewhere; under a category heading that prefix is noise.
 */
const CATEGORY_PREFIXES: Record<string, string> = {
  Interactivity: 'Interactivity: ',
  State: 'State: ',
  Sequence: 'Sequence: ',
  Class: 'Class: ',
  ER: 'ER: ',
  'XY Chart': 'XY: ',
  'Theme Showcase': 'Theme: ',
}

/**
 * A sidebar entry's label: the sample's title with its redundant category
 * prefix stripped (see CATEGORY_PREFIXES).
 */
function sidebarTitle(category: string, title: string): string {
  const prefix = CATEGORY_PREFIXES[category]
  return prefix && title.startsWith(prefix) ? title.slice(prefix.length) : title
}

// The theme picker (ThemePill/ThemePicker/INLINE_THEMES/DEFAULT_SWATCH) now
// lives in demo/components/theme-picker.tsx, shared with pages.ts — see that
// module for the doc comment. <IndexPage> embeds it directly.

async function generateHtml(): Promise<string> {
  // Step 0: Create Shiki highlighter for mermaid syntax highlighting in source panels.
  // We use 'github-light' as the base theme — its hex colors get overridden by CSS
  // color-mix() rules derived from --t-fg / --t-bg so tokens adapt to any theme.
  const styles = await loadStyles()
  const jsonLd = await buildJsonLd()

  const highlighter = await createHighlighter({
    langs: ['mermaid'],
    themes: ['github-light', 'github-dark'],
  })

  // Step 1: Bundle the mermaid renderer for the browser
  let bundleJs: string
  try {
    bundleJs = await bundleForBrowser(
      new URL('./src/browser.ts', import.meta.url).pathname,
      { minify: true },
    )
  } catch (err) {
    console.error('Bundle build failed:', err)
    process.exit(1)
  }
  console.log(`Browser bundle: ${(bundleJs.length / 1024).toFixed(1)} KB`)

  // Step 1b: Bundle the page's own client-side script the same way. It used
  // to be a ~680-line template literal in this file, which meant no type
  // checking, no linting, and no editor support for the largest piece of
  // behavior on the page. Left unminified so the emitted page stays
  // debuggable in devtools, as the hand-written version was.
  const clientJs = await bundleClientScript()
  console.log(`Client script: ${(clientJs.length / 1024).toFixed(1)} KB`)

  // Step 2: Build sample JSON (only serializable fields needed by client)
  const samplesJson = escapeJsonForScriptTag(
    JSON.stringify(
      samples.map((s) => ({
        title: s.title,
        description: s.description,
        source: s.source,
        category: s.category ?? 'Other',
        options: s.options ?? {},
      })),
    ),
  )

  // Step 3: Group samples by category for TOC (done at build time since it's static)
  const categories = new Map<string, number[]>()
  samples.forEach((sample, i) => {
    const cat = sample.category ?? 'Other'
    if (!categories.has(cat)) categories.set(cat, [])
    categories.get(cat)!.push(i)
  })

  // Build mapping from original index to display number (excluding Hero samples)
  const heroCount = samples.filter((s) => s.category === 'Hero').length
  const displayNum = (i: number) => i + 1 - heroCount

  const nonHeroCategories = [...categories.entries()].filter(
    ([cat]) => cat !== 'Hero',
  )

  // Step 4: Pre-highlight all sample sources with Shiki (build-time only, zero runtime cost).
  // The mermaid TextMate grammar requires a fenced code block prefix to tokenize properly
  // (see https://github.com/shikijs/shiki/issues/973), so we wrap each source with
  // ```mermaid ... ``` and then strip those fence lines from the output HTML.
  // Source panels use github-light — Shiki's inline colors are used directly.
  const highlightMermaid = (
    source: string,
    theme: 'github-light' | 'github-dark',
  ): string => {
    const fenced = '```mermaid\n' + source.trim() + '\n```'
    const html = highlighter.codeToHtml(fenced, { lang: 'mermaid', theme })
    // Strip the first line (```mermaid) and last line (```) from the output
    return html
      .replace(
        /(<code>)<span class="line">.*?<\/span>\n/, // first line
        '$1',
      )
      .replace(
        /\n<span class="line">.*?<\/span>(<\/code>)/, // last line
        '$1',
      )
  }

  const highlightedSources = samples.map((sample) =>
    highlightMermaid(sample.source, 'github-light'),
  )

  // The Hero sample's "before" code panel shows its real source verbatim
  // (the same string that drives the "after" render — including the
  // @-edge-id/animate plumbing) and uses github-dark, since it's a
  // stand-alone terminal-styled panel next to the rendered diagram, not the
  // regular light-themed source panel.
  const heroSample = samples.find((s) => s.category === 'Hero')
  if (!heroSample) {
    throw new Error('No sample with category "Hero" found in samples-data.ts')
  }
  const heroCodeHtml = highlightMermaid(heroSample.source, 'github-dark')

  // Step 5: Shape the per-sample card data the components render.
  // data-sample-bg stores the per-sample background for "Default" mode restoration.
  // Hero samples get a before/after transform treatment and are placed before
  // the "Samples" heading, so they're collected separately.
  const heroCards: HeroCard[] = []
  const regularCardByIndex = new Map<number, SampleCard>()

  samples.forEach((sample, i) => {
    const bg = sample.options?.bg ?? ''

    if (sample.category === 'Hero') {
      heroCards.push({ index: i, codeHtml: heroCodeHtml, bg })
    } else {
      regularCardByIndex.set(i, {
        index: i,
        title: sample.title,
        descriptionHtml: formatDescription(sample.description),
        highlightedSourceHtml: highlightedSources[i]!,
        optionsJson: sample.options ? JSON.stringify(sample.options) : null,
        bg,
      })
    }
  })

  const categorySections: CategorySection[] = nonHeroCategories.map(
    ([cat, indices]) => ({
      label: cat,
      slug: slugifyCategory(cat),
      items: indices.map((i) => ({
        index: i,
        displayNum: displayNum(i),
        title: sidebarTitle(cat, samples[i]!.title),
      })),
      cards: indices.map((i) => regularCardByIndex.get(i)!),
    }),
  )

  return renderHtmlDocument(
    createElement(IndexPage, {
      css: styles,
      jsonLd,
      samplesJson,
      moduleScript: `${bundleJs}\n${clientJs}`,
      totalSampleCount: samples.length - heroCount,
      heroCards,
      categories: categorySections,
    }),
  )
}

// ============================================================================
// Main
// ============================================================================

const html = await generateHtml()
const outPath = new URL('./index.html', import.meta.url).pathname
await writeFile(outPath, html)
console.log(`Written to ${outPath} (${(html.length / 1024).toFixed(1)} KB)`)
