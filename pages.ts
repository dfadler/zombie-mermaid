/**
 * Generates one static, indexable SEO landing page per diagram type — e.g.
 * "Flowchart diagrams" — plus a hub page listing all of them. Addresses
 * #266.
 *
 * Usage: tsx pages.ts
 *
 * Why this exists: the main demo (index.ts) is one page with 88+ samples —
 * great for browsing interactively, but a single URL, invisible to search
 * engines targeting a query like "mermaid flowchart example". These pages
 * give each diagram type its own URL, title, and meta description, with the
 * diagram rendered directly into the HTML at build time (no client-side JS
 * needed to see it) so there's real, crawlable content on first load.
 *
 * One page per type, not per (type × theme): an earlier version of this
 * generator produced one static page per (type × theme) combination — 90
 * pages total, each locked to one theme, with a "pick a different theme"
 * link that reloaded a whole new page. That didn't match how theming works
 * everywhere else on this site (index.ts: one page, an instant client-side
 * theme switch — see src/theme.ts's header comment on why that's cheap: a
 * rendered SVG's colors are entirely CSS custom properties, so switching
 * themes is a style update, never a re-render). This version renders each
 * diagram type once and embeds the same live theme picker, via
 * demo/diagram-page-client.ts — matching the demo's actual UX instead of a
 * page-per-theme matrix. The tradeoff: a search engine no longer gets a
 * distinct indexed URL per (type × theme) pair — only per type. Every real
 * theme is still reachable and rendered (just after one click, client-side),
 * so nothing about the library's own coverage is reduced, only the URL
 * matrix search engines can crawl directly.
 *
 * The theme picker is demo-site UI chrome, not part of the library's
 * rendered diagram output — same reasoning issue #284's sample search
 * already established: docs/decisions/no-script-interactivity.md's
 * no-`<script>` guarantee covers what renderMermaidSVG/renderMermaidASCII
 * emit, not the pages this repo's own demo site wraps that output in.
 *
 * Output: <repo root>/diagrams/<type-slug>.html (one per
 * DIAGRAM_TYPE_PROFILES entry), diagrams/index.html (the hub page),
 * diagrams/assets/diagram-page.css, diagrams/assets/diagram-page-client.js,
 * and sitemap.xml. build:site moves diagrams/ and sitemap.xml into site/
 * alongside index.html/editor.html, the same way it already does for those.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import * as esbuild from 'esbuild'
import { escapeHtml, escapeJsonForScriptTag } from './demo/format.ts'
import { THEMES } from './src/theme.ts'
import { DIAGRAM_TYPE_PROFILES } from './demo/diagram-pages-data.ts'
import { renderThemePicker } from './theme-picker.ts'
import { renderMermaidSVG } from './src/index.ts'
import { createHighlighter } from 'shiki'

/** The live site's base URL (see README's "Live Demo" badge) — used for canonical links and sitemap.xml. */
const SITE_URL = 'https://dfadler.github.io/zombie-mermaid'

const OUT_DIR = new URL('./diagrams/', import.meta.url)

/** Every page renders with this theme initially; the picker switches from here. */
const DEFAULT_THEME_KEY = Object.keys(THEMES)[0]!

/**
 * Builds the URL hash the live editor (editor/js/sharing.js's `getHashSource`)
 * already knows how to read: `#` + base64(JSON.stringify({source, theme})).
 * `Buffer.from(str, 'utf-8').toString('base64')` here matches the browser's
 * `btoa(unescape(encodeURIComponent(str)))` for any valid UTF-8 string — both
 * base64-encode the same UTF-8 byte sequence, just via different APIs.
 */
function editorHash(source: string, theme: string): string {
  const payload = JSON.stringify({ source, theme })
  return Buffer.from(payload, 'utf-8').toString('base64')
}

/** Bundle demo/diagram-page-client.ts for the browser (mirrors index.ts's bundleClientScript). */
async function bundleDiagramPageClient(): Promise<string> {
  const result = await esbuild.build({
    entryPoints: [
      new URL('./demo/diagram-page-client.ts', import.meta.url).pathname,
    ],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    minify: false,
    write: false,
  })
  return result.outputFiles[0]!.text
}

/** Renders the site header/theme-bar/breadcrumb/footer shell shared by every diagrams/ page. */
function renderShell(opts: {
  breadcrumb: string
  body: string
  homeHref: string
  themePillsHtml?: string
}): string {
  const themeBar = opts.themePillsHtml
    ? `
  <div class="theme-bar" id="theme-bar">
    <a class="brand-badge shadow-minimal" href="${opts.homeHref}"><span><strong>Zombie Mermaid</strong></span></a>
    <div class="theme-pills" id="theme-pills">
      ${opts.themePillsHtml}
    </div>
  </div>`
    : `
  <div class="site-header">
    <a class="brand-badge" href="${opts.homeHref}">
      <strong>Zombie Mermaid</strong>
    </a>
    <nav class="header-links">
      <a href="${opts.homeHref}">Samples</a>
      <a href="${opts.homeHref}editor">Editor</a>
      <a href="https://github.com/dfadler/zombie-mermaid" target="_blank" rel="noopener">GitHub</a>
    </nav>
  </div>`

  return `${themeBar}
  <div class="content-wrapper">
  <div class="breadcrumb">${opts.breadcrumb}</div>
${opts.body}
  <footer class="site-footer">
    <span>&copy; 2026 zombie-mermaid</span>
    <a href="https://github.com/dfadler/zombie-mermaid" target="_blank" rel="noopener noreferrer">GitHub</a>
  </footer>
  </div>`
}

function pageHtml(opts: {
  title: string
  description: string
  canonical: string
  cssHref: string
  faviconHref: string
  body: string
  bodyScript?: string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(opts.title)}</title>
  <meta name="description" content="${escapeHtml(opts.description)}" />
  <link rel="canonical" href="${opts.canonical}" />
  <meta property="og:title" content="${escapeHtml(opts.title)}" />
  <meta property="og:description" content="${escapeHtml(opts.description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${opts.canonical}" />
  <meta name="twitter:card" content="summary" />
  <link rel="icon" type="image/svg+xml" href="${opts.faviconHref}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${opts.cssHref}" />
</head>
<body>
${opts.body}
${opts.bodyScript ?? ''}
</body>
</html>`
}

async function main(): Promise<void> {
  await mkdir(new URL('./assets/', OUT_DIR), { recursive: true })

  // Copy the demo's full stylesheet plus this page type's own small
  // supplement, same two-file split dashboard.ts already uses (dashboard.css
  // on top of styles.css) — gets every design token, shadow-* utility, and
  // .theme-pill/.theme-bar rule "for free" instead of re-deriving them, so a
  // diagram page's chrome matches the main demo's exactly, not approximately.
  const [demoCss, pageCss] = await Promise.all([
    readFile(new URL('./demo/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('./demo/diagram-page.css', import.meta.url), 'utf8'),
  ])
  await writeFile(
    new URL('./assets/diagram-page.css', OUT_DIR),
    `${demoCss}\n${pageCss}`,
  )

  const clientJs = await bundleDiagramPageClient()
  await writeFile(new URL('./assets/diagram-page-client.js', OUT_DIR), clientJs)

  const highlighter = await createHighlighter({
    langs: ['mermaid'],
    themes: ['github-light'],
  })

  const themesJson = escapeJsonForScriptTag(JSON.stringify(THEMES))
  const themePillsHtml = renderThemePicker({
    includeDefault: false,
    activeThemeKey: DEFAULT_THEME_KEY,
  })

  const sitemapUrls: string[] = [`${SITE_URL}/`, `${SITE_URL}/editor`]

  const otherTypesGrid = (currentSlug: string) =>
    DIAGRAM_TYPE_PROFILES.map((p) => {
      const current = p.slug === currentSlug ? ' is-current' : ''
      return `        <a class="link-grid-item${current}" href="${p.slug}.html">${escapeHtml(p.label)}</a>`
    }).join('\n')

  for (const profile of DIAGRAM_TYPE_PROFILES) {
    const colors = THEMES[DEFAULT_THEME_KEY]!

    const svg = renderMermaidSVG(profile.source, {
      ...colors,
      title: `${profile.label} diagram, zombie-mermaid`,
      interactivity: 'none',
    })

    const fenced = '```mermaid\n' + profile.source.trim() + '\n```'
    const highlightedHtml = highlighter.codeToHtml(fenced, {
      lang: 'mermaid',
      theme: 'github-light',
    })
    const highlightedSource = highlightedHtml
      .replace(/(<code>)<span class="line">.*?<\/span>\n/, '$1')
      .replace(/\n<span class="line">.*?<\/span>(<\/code>)/, '$1')

    const title = `${profile.label} examples | Zombie Mermaid`
    const description = `${profile.intro} Rendered live in any of ${Object.keys(THEMES).length} built-in themes — free, open source, and dependency-free.`
    const canonical = `${SITE_URL}/diagrams/${profile.slug}.html`
    sitemapUrls.push(canonical)

    const body = renderShell({
      homeHref: '../',
      themePillsHtml,
      breadcrumb: `<a href="../">Home</a><span class="sep">/</span><a href="./">Diagrams</a><span class="sep">/</span>${escapeHtml(profile.label)}`,
      body: `
  <h1>${escapeHtml(profile.label)} examples</h1>
  <p class="lede">${escapeHtml(profile.intro)}</p>

  <div class="diagram-frame">
${svg}
  </div>

  <div class="cta-row">
    <a class="cta-btn primary" href="../editor#${editorHash(profile.source, DEFAULT_THEME_KEY)}">Open in the live editor</a>
    <a class="cta-btn" href="../#samples-heading">See all samples</a>
  </div>

  <h2 class="source-heading">Mermaid source</h2>
  <div class="source-panel">
${highlightedSource}
  </div>

  <div class="section">
    <h2>Other diagram types</h2>
    <div class="link-grid">
${otherTypesGrid(profile.slug)}
    </div>
  </div>
`,
    })

    const sourceJson = escapeJsonForScriptTag(JSON.stringify(profile.source))
    const themeDataScript = `<script>window.__diagramPageThemes = ${themesJson}; window.__diagramPageSource = ${sourceJson};</script>`
    const clientScript = `<script type="module" src="assets/diagram-page-client.js"></script>`

    const html = pageHtml({
      title,
      description,
      canonical,
      cssHref: 'assets/diagram-page.css',
      faviconHref: '../favicon.svg',
      body,
      bodyScript: `${themeDataScript}\n${clientScript}`,
    })

    await writeFile(new URL(`./${profile.slug}.html`, OUT_DIR), html)
  }

  // -- Hub page: diagrams/index.html, listing every generated type page --
  const hubCanonical = `${SITE_URL}/diagrams/`
  sitemapUrls.push(hubCanonical)

  const typeLinks = DIAGRAM_TYPE_PROFILES.map((profile) => {
    return `
  <section class="type-group">
    <h2><a href="${profile.slug}.html">${escapeHtml(profile.label)}</a></h2>
    <p class="type-intro">${escapeHtml(profile.intro)}</p>
  </section>`
  }).join('\n')

  const hubBody = renderShell({
    homeHref: '../',
    breadcrumb: `<a href="../">Home</a><span class="sep">/</span>Diagrams`,
    body: `
  <h1>Every diagram type</h1>
  <p class="lede">zombie-mermaid renders ${DIAGRAM_TYPE_PROFILES.length} Mermaid diagram types, each with a live picker across every one of its ${Object.keys(THEMES).length} built-in themes. Pick a diagram type below.</p>
${typeLinks}
`,
  })

  const hubHtml = pageHtml({
    title: `Diagram gallery: every type | Zombie Mermaid`,
    description: `Browse every zombie-mermaid diagram type: ${DIAGRAM_TYPE_PROFILES.map((p) => p.label).join(', ')} — each rendered live in any of ${Object.keys(THEMES).length} built-in themes including Nord, Dracula, Tokyo Night, and GitHub.`,
    canonical: hubCanonical,
    cssHref: 'assets/diagram-page.css',
    faviconHref: '../favicon.svg',
    body: hubBody,
  })

  await writeFile(new URL('./index.html', OUT_DIR), hubHtml)

  // -- sitemap.xml --
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`).join('\n')}
</urlset>
`
  await writeFile(new URL('./sitemap.xml', import.meta.url), sitemap)

  console.log(
    `Wrote ${DIAGRAM_TYPE_PROFILES.length} diagram pages + hub page + sitemap.xml (${sitemapUrls.length} URLs) to ${OUT_DIR.pathname}`,
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exitCode = 1
})
