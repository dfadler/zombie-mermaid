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
 */

import { readFile, writeFile } from 'node:fs/promises'
import { escapeHtml, formatDescription } from './demo/format.ts'
import * as esbuild from 'esbuild'
import { samples } from './samples-data.ts'
import { THEMES } from './src/theme.ts'
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
  const result = await esbuild.build({
    entryPoints: [new URL('./demo/client.ts', import.meta.url).pathname],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    minify: false,
    write: false,
  })
  return result.outputFiles[0]!.text
}

/**
 * Make a JSON payload safe to embed in a `<script>` element.
 *
 * An HTML parser ends a script element at the first `</script`, wherever it
 * appears — including inside a JSON string. A sample whose Mermaid source
 * contained that sequence would truncate the page. JSON.stringify does not
 * escape `<`, so the sequence is broken up here.
 */
function escapeJsonForScriptTag(json: string): string {
  return json.replace(/<\/(script)/gi, '<\\/$1')
}

// ============================================================================
// HTML generation — dynamic version
//
// Instead of pre-rendering SVGs at build time, we:
//   1. Bundle the mermaid renderer for the browser via esbuild's build() API
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

/** Human-readable labels for theme keys */
const THEME_LABELS: Record<string, string> = {
  'zinc-dark': 'Zinc Dark',
  'tokyo-night': 'Tokyo Night',
  'tokyo-night-storm': 'Tokyo Storm',
  'tokyo-night-light': 'Tokyo Light',
  'catppuccin-mocha': 'Catppuccin',
  'catppuccin-latte': 'Latte',
  nord: 'Nord',
  'nord-light': 'Nord Light',
  dracula: 'Dracula',
  'github-light': 'GitHub',
  'github-dark': 'GitHub Dark',
  'solarized-light': 'Solarized',
  'solarized-dark': 'Solar Dark',
  'one-dark': 'One Dark',
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
 * Build the sidebar: one collapsible group per category, each listing its
 * samples.
 *
 * @param displayNum maps a sample's array index to the number shown to the
 *   reader, which skips the Hero samples.
 */
function renderSidebar(
  categoriesInOrder: Array<[string, number[]]>,
  displayNum: (index: number) => number,
): string {
  return categoriesInOrder
    .map(([cat, indices], categoryIndex) => {
      const prefix = CATEGORY_PREFIXES[cat]
      const slug = slugifyCategory(cat)
      const items = indices
        .map((i) => {
          let title = samples[i]!.title
          if (prefix && title.startsWith(prefix)) {
            title = title.slice(prefix.length)
          }
          return `<li><a href="#sample-${i}"><span class="sidebar-num">${displayNum(i)}.</span> ${escapeHtml(title)}</a></li>`
        })
        .join('\n            ')
      // The first category is the default active/expanded one (matches the
      // category-view shown on initial load, before JS reads location.hash).
      const openAttr = categoryIndex === 0 ? ' open' : ''
      return `
        <details class="sidebar-group" data-category-slug="${slug}" data-category-label="${escapeHtml(cat)}"${openAttr}>
          <summary>${escapeHtml(cat)} <span class="sidebar-group-count">(${indices.length})</span></summary>
          <ol class="sidebar-list" start="${displayNum(indices[0]!)}">
            ${items}
          </ol>
        </details>`
    })
    .join('\n')
}

/** Themes shown as inline pills; the rest live in the "More" dropdown. */
const INLINE_THEMES = new Set(['dracula', 'solarized-light'])

/** The Default (no theme) pill's swatch colors. */
const DEFAULT_SWATCH = { bg: '#FFFFFF', fg: '#27272A' }

/** One theme pill, with a color swatch rendered at build time. */
function renderThemePill(
  key: string,
  colors: { bg: string; fg: string },
  active = false,
): string {
  const isDark = parseInt(colors.bg.replace('#', '').slice(0, 2), 16) < 0x80
  const shadow = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'
  const label = key === '' ? 'Default' : (THEME_LABELS[key] ?? key)
  const activeClass = active ? ' active' : ''
  return `<button class="theme-pill shadow-minimal${activeClass}" data-theme="${key}"><span class="theme-swatch" style="background:${colors.bg};box-shadow:inset 0 0 0 1px ${shadow}"></span>${escapeHtml(label)}</button>`
}

/**
 * Build the theme picker: a few pills inline, every theme in a dropdown.
 *
 * Both lists include Default, so the dropdown is a complete picker on its own
 * and the inline pills are a shortcut rather than a separate set.
 */
function renderThemePicker(): string {
  const themeEntries = Object.entries(THEMES)

  const visiblePills = [
    renderThemePill('', DEFAULT_SWATCH, true),
    ...themeEntries
      .filter(([key]) => INLINE_THEMES.has(key))
      .map(([key, colors]) => renderThemePill(key, colors)),
  ]

  const allDropdownPills = [
    renderThemePill('', DEFAULT_SWATCH, true),
    ...themeEntries.map(([key, colors]) => renderThemePill(key, colors)),
  ]

  return `
    <div class="theme-pills-inline">
      ${visiblePills.join('\n      ')}
    </div>
    <div class="theme-more-wrapper">
      <button class="theme-pill shadow-minimal" id="theme-more-btn">${allDropdownPills.length} Themes</button>
      <div class="theme-more-dropdown shadow-modal-small" id="theme-more-dropdown">
        ${allDropdownPills.join('\n        ')}
      </div>
    </div>`
}

async function generateHtml(): Promise<string> {
  // Step 0: Create Shiki highlighter for mermaid syntax highlighting in source panels.
  // We use 'github-light' as the base theme — its hex colors get overridden by CSS
  // color-mix() rules derived from --t-fg / --t-bg so tokens adapt to any theme.
  const styles = await loadStyles()

  const highlighter = await createHighlighter({
    langs: ['mermaid'],
    themes: ['github-light', 'github-dark'],
  })

  // Step 1: Bundle the mermaid renderer for the browser
  let bundleJs: string
  try {
    const buildResult = await esbuild.build({
      entryPoints: [new URL('./src/browser.ts', import.meta.url).pathname],
      bundle: true,
      platform: 'browser',
      format: 'esm',
      minify: true,
      write: false,
    })
    bundleJs = buildResult.outputFiles[0]!.text
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

  const tocSections = renderSidebar(nonHeroCategories, displayNum)

  // Step 3b: Build theme selector pills (build-time so we include swatches)
  const themePillsHtml = renderThemePicker()

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

  // Step 5: Build sample card HTML shells (SVG + ASCII are empty, filled client-side)
  // data-sample-bg stores the per-sample background for "Default" mode restoration.
  // Hero samples get a before/after transform treatment and are placed before "Samples" heading.
  const heroCards: string[] = []
  const regularCardHtmlByIndex = new Map<number, string>()

  samples.forEach((sample, i) => {
    const bg = sample.options?.bg ?? ''
    const isHero = sample.category === 'Hero'

    if (isHero) {
      // Hero sample: raw source (left/top) transforms into the live,
      // theme-reactive rendered diagram (right/bottom) — no header/ASCII
      // panel, since this is a showcase, not a browsable sample.
      heroCards.push(`
    <section class="sample sample-hero" id="sample-${i}">
      <div class="hero-transform">
        <div class="hero-code-panel">
          <div class="hero-code-titlebar">
            <span class="hero-code-dots">
              <span class="dot dot-red"></span>
              <span class="dot dot-yellow"></span>
              <span class="dot dot-green"></span>
            </span>
            <span class="hero-code-title">pipeline.mmd</span>
          </div>
          <div class="hero-code-body">${heroCodeHtml}</div>
        </div>
        <div class="hero-arrow" aria-hidden="true">
          <span class="hero-arrow-caption">renders as</span>
          <svg class="hero-arrow-icon" viewBox="0 0 56 56" fill="none">
            <defs>
              <linearGradient id="hero-arrow-grad-${i}" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stop-color="#9570BE"/>
                <stop offset="1" stop-color="#3b82f6"/>
              </linearGradient>
            </defs>
            <line x1="4" y1="28" x2="44" y2="28" stroke="url(#hero-arrow-grad-${i})" stroke-width="2.5" stroke-linecap="round" class="hero-arrow-dash"/>
            <path d="M36 16 L52 28 L36 40" stroke="url(#hero-arrow-grad-${i})" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </div>
        <div class="hero-diagram-panel" id="svg-panel-${i}" data-sample-bg="${bg}">
          <div class="svg-container" id="svg-${i}">
            <div class="loading-spinner"></div>
          </div>
          <div class="hero-tag-row">
            <span class="hero-tag">SVG</span>
            <span class="hero-tag">ASCII</span>
            <span class="hero-tag hero-tag-brand">16 Themes</span>
            <span class="hero-tag">Animated Edges</span>
          </div>
        </div>
      </div>
    </section>`)
    } else {
      regularCardHtmlByIndex.set(
        i,
        `
    <section class="sample" id="sample-${i}">
      <div class="sample-header">
        <h2>${escapeHtml(sample.title)}</h2>
        <p class="description">${formatDescription(sample.description)}</p>
      </div>
      <div class="sample-content">
        <div class="source-panel" id="source-panel-${i}">
          ${highlightedSources[i]}
          ${sample.options ? `<div class="options"><strong>Options:</strong> <code>${escapeHtml(JSON.stringify(sample.options))}</code></div>` : ''}
          <button class="edit-btn" data-sample="${i}">Edit</button>
        </div>
        <div class="output-panel">
          <div class="output-head">
            <div class="seg" role="tablist" aria-label="Output format">
              <button type="button" class="seg-btn" data-view="svg" role="tab" aria-selected="true">SVG</button>
              <button type="button" class="seg-btn" data-view="ascii" role="tab" aria-selected="false">ASCII</button>
            </div>
          </div>
          <div class="output-stage">
            <div class="svg-panel is-active" id="svg-panel-${i}" data-sample-bg="${bg}">
              <div class="svg-container" id="svg-${i}">
                <div class="loading-spinner"></div>
              </div>
            </div>
            <div class="ascii-panel" id="ascii-panel-${i}">
              <div class="terminal-window">
                <div class="terminal-titlebar">
                  <span class="terminal-dots" aria-hidden="true">
                    <span class="terminal-dot terminal-dot-red"></span>
                    <span class="terminal-dot terminal-dot-yellow"></span>
                    <span class="terminal-dot terminal-dot-green"></span>
                  </span>
                  <span class="terminal-title">ascii</span>
                </div>
                <pre class="ascii-output"><code id="ascii-${i}">Rendering\u2026</code><span class="terminal-cursor" aria-hidden="true">&nbsp;</span></pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>`,
      )
    }
  })

  const heroCardsHtml = heroCards.join('\n')

  // Group regular sample cards into one <section> per category. Only the
  // first category ships visible \u2014 the rest carry `hidden` so a first-time
  // visitor's initial payload isn't "render everything at once": the other
  // categories' diagrams are rendered client-side on demand, when a sidebar
  // category is opened (see the "Category switching" client script below).
  const categoryViewsHtml = nonHeroCategories
    .map(([cat, indices], categoryIndex) => {
      const slug = slugifyCategory(cat)
      const cardsHtml = indices
        .map((i) => regularCardHtmlByIndex.get(i))
        .join('\n')
      const hiddenAttr = categoryIndex === 0 ? '' : ' hidden'
      return `
    <section class="category-view" id="category-${slug}" data-category="${slug}"${hiddenAttr}>
      ${cardsHtml}
    </section>`
    })
    .join('\n')

  // ============================================================================
  // Step 5: Assemble full HTML
  // ============================================================================

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" id="theme-color-meta" content="#f9f9fa" />
  <title>Zombie Mermaid — Mermaid Rendering, Made Beautiful</title>
  <meta name="description" content="Open source diagram rendering library built for the AI era. Ultra-fast, fully themeable, outputs to SVG and ASCII. Supports Flowchart, State, Sequence, Class, and ER diagrams." />
  <link rel="icon" type="image/svg+xml" href="favicon.svg" />
  <link rel="icon" type="image/x-icon" href="favicon.ico" />
  <link rel="apple-touch-icon" href="apple-touch-icon.png" />
  <meta property="og:title" content="Zombie Mermaid" />
  <meta property="og:description" content="Open source diagram rendering library built for the AI era. Ultra-fast, fully themeable, outputs to SVG and ASCII." />
  <meta property="og:image" content="https://agents.craft.do/mermaid/og-image.png" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://agents.craft.do/mermaid" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Zombie Mermaid" />
  <meta name="twitter:description" content="Mermaid rendering, made beautiful. Ultra-fast, fully themeable, outputs to SVG and ASCII." />
  <meta name="twitter:image" content="https://agents.craft.do/mermaid/og-image.png" />
  <!-- Plausible Analytics -->
  <script defer data-domain="agents.craft.do/mermaid" src="https://plausible.io/js/script.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
${styles}
  </style>
</head>
<body>
  <!-- Safari 26+ reads title bar color from the topmost fixed element's background.
       This invisible 1px div provides a real DOM element for Safari to detect. -->
  <div id="safari-theme-color" style="position:fixed;top:0;left:0;right:0;height:1px;background:var(--theme-bar-bg);z-index:9999;pointer-events:none;"></div>

  <!-- Scroll progress bar — filled client-side as the page scrolls -->
  <div class="scroll-progress" id="scroll-progress" aria-hidden="true">
    <div class="scroll-progress-bar" id="scroll-progress-bar"></div>
  </div>

  <!-- Navigation + theme bar -->
  <div class="theme-bar" id="theme-bar">
    <button class="sidebar-toggle shadow-minimal" id="sidebar-toggle" aria-label="Toggle sample navigation" aria-controls="sidebar" aria-expanded="false"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/></svg></button>
    <a class="brand-badge shadow-minimal" href="https://github.com/dfadler/zombie-mermaid" target="_blank" rel="noopener"><span><strong>Zombie Mermaid</strong></span></a>
    <div class="theme-pills" id="theme-pills">
      ${themePillsHtml}
    </div>
  </div>

  <div class="sidebar-backdrop" id="sidebar-backdrop"></div>

  <!-- Persistent mobile/tablet nav: the sidebar (with its category list and
       active-category state) is hidden behind the hamburger below 1024px, so
       this stays pinned to the bottom of the viewport the whole time a
       visitor scrolls a category's samples — not just once they reach the
       end — as the one place that always says what they're viewing and how
       to reach the rest. Sits above the scroll-progress line (see
       demo/styles.css) rather than replacing it — that line tracks raw
       page-scroll position, this tracks category identity; both answer a
       different half of "is there more, and where." -->
  <div class="category-tabbar" id="category-tabbar">
    <span class="category-tabbar-label">Viewing <strong id="tabbar-category-name"></strong></span>
    <button type="button" class="category-banner-btn" id="tabbar-browse-btn">
      Browse types
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
  </div>

  <div class="page-shell">
  <nav class="sidebar" id="sidebar" aria-label="Sample navigation">
    ${tocSections}
  </nav>
  <div class="page-main">

  <!-- Hero header section -->
  <header class="hero-header">
    <h1 class="hero-title">Zombie Mermaid</h1>
    <p class="hero-tagline">Mermaid Rendering, made beautiful.</p>
    <p class="hero-description">
      An open source library for rendering diagrams, designed for the age of AI: <a href="https://www.npmjs.com/package/zombie-mermaid" target="_blank" rel="noopener"><code>zombie-mermaid</code></a>.
      Ultra-fast, fully themeable, and outputs to both SVG and ASCII.
    </p>
    <div class="hero-buttons">
      <a href="editor" id="editor-link" class="hero-btn hero-btn-primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        Editor
      </a>
      <a href="https://github.com/dfadler/zombie-mermaid" target="_blank" rel="noopener" class="hero-btn hero-btn-secondary">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
        GitHub
      </a>
      <a href="fork-fixes.html" class="hero-btn hero-btn-secondary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        What this fork fixes
      </a>
      <button type="button" class="hero-btn hero-btn-secondary" id="random-theme-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
        Random Theme
      </button>
    </div>
    <div class="hero-meta">
      <p class="meta" id="total-timing">Rendering ${samples.length * 2} samples\u2026</p>
      <div class="meta">ASCII rendering based on <a href="https://github.com/AlexanderGrooff/mermaid-ascii" target="_blank" rel="noopener">Mermaid-ASCII</a></div>
      <div class="meta">Early preview — actively evolving</div>
    </div>
  </header>

  <div class="content-wrapper">

${heroCardsHtml}

  <div class="samples-heading">
    <h2 class="section-title">Samples</h2>
    <div class="category-banner" id="category-banner">
      <span>Showing <strong id="active-category-name"></strong> — <span id="active-category-count"></span> of ${samples.length - heroCount} samples</span>
      <button type="button" class="category-banner-btn" id="browse-categories-btn">Browse diagram types</button>
    </div>
  </div>

${categoryViewsHtml}

  <!-- Sample definitions, read by the client script. Passed through the DOM
       rather than interpolated into demo/client.ts so that file stays plain,
       type-checkable code with no build-time substitution. -->
  <script type="application/json" id="demo-samples">${samplesJson}</script>

  <!-- Bundled mermaid renderer — exposes window.__mermaid -->
  <script type="module">
${bundleJs}
${clientJs}
  </script>

  <!-- Edit dialog (shared single instance) -->
  <div class="edit-overlay" id="edit-overlay">
    <div class="edit-dialog shadow-modal-small">
      <div class="edit-dialog-header">
        <span class="edit-dialog-title">Edit Diagram</span>
        <button class="edit-dialog-close" id="edit-dialog-close">&times;</button>
      </div>
      <textarea class="edit-dialog-textarea" id="edit-dialog-textarea"
        spellcheck="false" autocomplete="off" autocorrect="off"></textarea>
      <div class="edit-dialog-footer">
        <button class="edit-dialog-btn edit-dialog-cancel" id="edit-dialog-cancel">Cancel</button>
        <button class="edit-dialog-btn edit-dialog-save" id="edit-dialog-save">Save &amp; Render</button>
      </div>
    </div>
  </div>

  </div><!-- .content-wrapper -->

  </div><!-- .page-main -->
  </div><!-- .page-shell -->

  <footer class="site-footer">
    <span>&copy; 2026 zombie-mermaid</span>
    <div class="footer-links">
      <a href="https://github.com/dfadler/zombie-mermaid" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      </a>
    </div>
  </footer>
</body>
</html>`
}

// ============================================================================
// Main
// ============================================================================

const html = await generateHtml()
const outPath = new URL('./index.html', import.meta.url).pathname
await writeFile(outPath, html)
console.log(`Written to ${outPath} (${(html.length / 1024).toFixed(1)} KB)`)
