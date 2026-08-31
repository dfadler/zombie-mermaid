/**
 * Generates one static, indexable SEO landing page per (diagram type ×
 * theme) combination — e.g. "Flowchart — Nord theme" — plus a hub page
 * listing all of them. Addresses #266.
 *
 * Usage: tsx pages.ts
 *
 * Why this exists: the main demo (index.ts) is one page with a client-side
 * theme switcher — great for browsing interactively, invisible to search
 * engines targeting a specific query like "mermaid dracula theme flowchart".
 * These pages give each of those combinations its own URL, title, and meta
 * description, with the diagram rendered directly into the HTML at build
 * time (no client-side JS needed to see it) so there's real, crawlable
 * content on first load.
 *
 * Output: <repo root>/diagrams/<type-slug>/<theme-slug>.html (90 pages, one
 * per DIAGRAM_TYPE_PROFILES × THEMES combination), diagrams/index.html (the
 * hub page), diagrams/assets/diagram-page.css, and sitemap.xml. build:site
 * moves diagrams/ and sitemap.xml into site/ alongside index.html/editor.html,
 * the same way it already does for those.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { escapeHtml } from './demo/format.ts'
import { THEMES } from './src/theme.ts'
import { THEME_LABELS, THEME_DESCRIPTIONS } from './demo/theme-labels.ts'
import { DIAGRAM_TYPE_PROFILES } from './demo/diagram-pages-data.ts'
import { renderMermaidSVG } from './src/index.ts'
import { createHighlighter } from 'shiki'

/** The live site's base URL (see README's "Live Demo" badge) — used for canonical links and sitemap.xml. */
const SITE_URL = 'https://dfadler.github.io/zombie-mermaid'

const OUT_DIR = new URL('./diagrams/', import.meta.url)
const themeKeys = Object.keys(THEMES)

/** Renders the site header/breadcrumb/footer shell shared by every diagrams/ page. */
function renderShell(opts: {
  breadcrumb: string
  body: string
  homeHref: string
}): string {
  return `
  <div class="site-header">
    <a class="brand-badge" href="${opts.homeHref}">
      <strong>Zombie Mermaid</strong>
    </a>
    <nav class="header-links">
      <a href="${opts.homeHref}">Samples</a>
      <a href="${opts.homeHref}editor">Editor</a>
      <a href="https://github.com/dfadler/zombie-mermaid" target="_blank" rel="noopener">GitHub</a>
    </nav>
  </div>
  <div class="breadcrumb">${opts.breadcrumb}</div>
${opts.body}
  <footer class="site-footer">
    <span>&copy; 2026 zombie-mermaid</span>
    <a href="https://github.com/dfadler/zombie-mermaid" target="_blank" rel="noopener noreferrer">GitHub</a>
  </footer>`
}

function pageHtml(opts: {
  title: string
  description: string
  canonical: string
  cssHref: string
  faviconHref: string
  body: string
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
  <div class="page-shell">
${opts.body}
  </div>
</body>
</html>`
}

async function main(): Promise<void> {
  await mkdir(new URL('./assets/', OUT_DIR), { recursive: true })

  // Copy the stylesheet as-is into the output tree — a real .css file so
  // stylelint/prettier/editor tooling can see it, same reasoning as
  // demo/styles.css (see index.ts's loadStyles doc comment).
  const css = await readFile(
    new URL('./demo/diagram-page.css', import.meta.url),
    'utf8',
  )
  await writeFile(new URL('./assets/diagram-page.css', OUT_DIR), css)

  const highlighter = await createHighlighter({
    langs: ['mermaid'],
    themes: ['github-light'],
  })
  // Each diagram type's source is theme-independent — highlight once per
  // type rather than once per (type × theme) page.
  const highlightedSourceByType = new Map<string, string>()
  for (const profile of DIAGRAM_TYPE_PROFILES) {
    const fenced = '```mermaid\n' + profile.source.trim() + '\n```'
    const html = highlighter.codeToHtml(fenced, {
      lang: 'mermaid',
      theme: 'github-light',
    })
    const stripped = html
      .replace(/(<code>)<span class="line">.*?<\/span>\n/, '$1')
      .replace(/\n<span class="line">.*?<\/span>(<\/code>)/, '$1')
    highlightedSourceByType.set(profile.slug, stripped)
  }

  const sitemapUrls: string[] = [`${SITE_URL}/`, `${SITE_URL}/editor`]

  for (const profile of DIAGRAM_TYPE_PROFILES) {
    await mkdir(new URL(`./${profile.slug}/`, OUT_DIR), { recursive: true })

    for (const themeKey of themeKeys) {
      const colors = THEMES[themeKey]!
      const themeLabel = THEME_LABELS[themeKey] ?? themeKey
      const themeDescription = THEME_DESCRIPTIONS[themeKey] ?? ''

      const svg = renderMermaidSVG(profile.source, {
        ...colors,
        title: `${profile.label} diagram rendered with the ${themeLabel} theme`,
        interactivity: 'none',
      })

      const title = `${profile.label} — ${themeLabel} theme | Zombie Mermaid`
      const description = `${profile.intro} Shown here in ${themeLabel}: ${themeDescription} Free, open source, and dependency-free — render your own with zombie-mermaid.`
      const canonical = `${SITE_URL}/diagrams/${profile.slug}/${themeKey}.html`
      sitemapUrls.push(canonical)

      const otherThemesGrid = themeKeys
        .map((otherKey) => {
          const otherColors = THEMES[otherKey]!
          const otherLabel = THEME_LABELS[otherKey] ?? otherKey
          const current = otherKey === themeKey ? ' is-current' : ''
          return `        <a class="link-grid-item${current}" href="../${profile.slug}/${otherKey}.html"><span class="swatch" style="background:${otherColors.bg}"></span>${escapeHtml(otherLabel)}</a>`
        })
        .join('\n')

      const otherTypesGrid = DIAGRAM_TYPE_PROFILES.map((otherProfile) => {
        const current = otherProfile.slug === profile.slug ? ' is-current' : ''
        return `        <a class="link-grid-item${current}" href="../${otherProfile.slug}/${themeKey}.html">${escapeHtml(otherProfile.label)}</a>`
      }).join('\n')

      const body = renderShell({
        homeHref: '../../',
        breadcrumb: `<a href="../../">Home</a><span class="sep">/</span><a href="../">Diagrams</a><span class="sep">/</span>${escapeHtml(profile.label)}<span class="sep">/</span>${escapeHtml(themeLabel)}`,
        body: `
  <h1>${escapeHtml(profile.label)} diagrams in the ${escapeHtml(themeLabel)} theme</h1>
  <p class="lede">${escapeHtml(profile.intro)}</p>

  <div class="diagram-frame">
${svg}
  </div>

  <div class="cta-row">
    <a class="cta-btn primary" href="../../editor">Open in the live editor</a>
    <a class="cta-btn" href="../../#samples-heading">See all samples</a>
  </div>

  <h2 class="source-heading">Mermaid source</h2>
  <div class="source-panel">
${highlightedSourceByType.get(profile.slug) ?? ''}
  </div>

  <div class="section">
    <h2>About the ${escapeHtml(themeLabel)} theme</h2>
    <p>${escapeHtml(themeDescription)}</p>
  </div>

  <div class="section">
    <h2>Other themes for ${escapeHtml(profile.label)} diagrams</h2>
    <div class="link-grid">
${otherThemesGrid}
    </div>
  </div>

  <div class="section">
    <h2>Other diagram types in ${escapeHtml(themeLabel)}</h2>
    <div class="link-grid">
${otherTypesGrid}
    </div>
  </div>
`,
      })

      const html = pageHtml({
        title,
        description,
        canonical,
        cssHref: '../assets/diagram-page.css',
        faviconHref: '../../favicon.svg',
        body,
      })

      await writeFile(
        new URL(`./${profile.slug}/${themeKey}.html`, OUT_DIR),
        html,
      )
    }
  }

  // -- Hub page: diagrams/index.html, listing every generated page grouped by type --
  const hubCanonical = `${SITE_URL}/diagrams/`
  sitemapUrls.push(hubCanonical)

  const typeGroups = DIAGRAM_TYPE_PROFILES.map((profile) => {
    const links = themeKeys
      .map((themeKey) => {
        const themeColors = THEMES[themeKey]!
        const themeLabel = THEME_LABELS[themeKey] ?? themeKey
        return `        <a href="${profile.slug}/${themeKey}.html"><span class="swatch" style="background:${themeColors.bg}"></span>${escapeHtml(themeLabel)}</a>`
      })
      .join('\n')
    return `
  <section class="type-group">
    <h2>${escapeHtml(profile.label)}</h2>
    <p class="type-intro">${escapeHtml(profile.intro)}</p>
    <div class="link-grid">
${links}
    </div>
  </section>`
  }).join('\n')

  const hubBody = renderShell({
    homeHref: '../',
    breadcrumb: `<a href="../">Home</a><span class="sep">/</span>Diagrams`,
    body: `
  <h1>Every diagram type, in every theme</h1>
  <p class="lede">zombie-mermaid renders ${DIAGRAM_TYPE_PROFILES.length} Mermaid diagram types across ${themeKeys.length} built-in themes — ${DIAGRAM_TYPE_PROFILES.length * themeKeys.length} combinations in total. Pick a diagram type below to see it rendered in every theme, or jump straight to a specific pairing.</p>
${typeGroups}
`,
  })

  const hubHtml = pageHtml({
    title: `Diagram gallery: every type × theme | Zombie Mermaid`,
    description: `Browse all ${DIAGRAM_TYPE_PROFILES.length * themeKeys.length} zombie-mermaid diagram renders: ${DIAGRAM_TYPE_PROFILES.map((p) => p.label).join(', ')} in ${themeKeys.length} built-in themes including Nord, Dracula, Tokyo Night, and GitHub.`,
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

  const pageCount = DIAGRAM_TYPE_PROFILES.length * themeKeys.length
  console.log(
    `Wrote ${pageCount} diagram pages + hub page + sitemap.xml (${sitemapUrls.length} URLs) to ${OUT_DIR.pathname}`,
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exitCode = 1
})
