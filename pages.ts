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
 * theme switch — see packages/core/src/theme.ts's header comment on why that's cheap: a
 * rendered SVG's colors are entirely CSS custom properties, so switching
 * themes is a style update, never a re-render). This version renders each
 * diagram type once and embeds the same live theme picker, via
 * demo/diagram-type-client.tsx — matching the demo's actual UX instead of a
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
 * Output: <output dir>/diagrams/<type-slug>.html (one per
 * DIAGRAM_TYPE_PROFILES entry), diagrams/index.html (the hub page),
 * diagrams/assets/diagram-page.css, diagrams/assets/diagram-page-client.js,
 * and sitemap.xml — resolved relative to the repo root by default, or to
 * `SITE_OUT_DIR` when set (see scripts/site-out-dir.ts). build:site sets
 * `SITE_OUT_DIR=site` so this writes directly into site/, alongside
 * index.html/editor.html, rather than needing to be moved there afterward.
 */

import { readFile } from 'node:fs/promises'
import { createElement } from 'react'
import { bundleForBrowser } from './scripts/vite-bundle.ts'
import { siteOutDir } from './scripts/site-out-dir.ts'
import { generatePage } from './scripts/generate-page.ts'
import {
  escapeHtml,
  escapeJsonForScriptTag,
  stripShikiFenceLines,
} from './demo/format.ts'
import { renderHtmlDocument } from './demo/render-html.ts'
import {
  DiagramDetailPage,
  DiagramHubPage,
  DiagramTypePage,
  type DiagramDetailCrosslink,
  type OrientationVariants,
} from './demo/components/diagram-page.tsx'
import { THEMES } from '@zombie-mermaid/core'
import {
  DIAGRAM_TYPE_PROFILES,
  allExamplesFor,
  sampleSlug,
} from './demo/diagram-pages-data.ts'
import { DEFAULT_SWATCH } from './demo/components/theme-picker.tsx'
import type { Sample } from './samples-data.ts'
import { renderMermaidASCII, renderMermaidSVG } from './src/index.ts'
import type { RenderOptions } from './src/index.ts'
import { diagramColorsToAsciiTheme } from '@zombie-mermaid/ascii-renderer'
import { createHighlighter } from 'shiki'
import {
  wideDiagramDirectionLine,
  withNarrowDirection,
  NARROW_DIRECTION,
  withUniqueSvgIds,
} from './demo/diagram-orientation.ts'

/** The live site's base URL (see README's "Live Demo" badge) — used for canonical links and sitemap.xml. */
const SITE_URL = 'https://dfadler.github.io/zombie-mermaid'

const OUT_DIR = new URL('./diagrams/', siteOutDir(import.meta.url))

/**
 * Every page renders with this theme initially; the picker switches from
 * here. Set to '' (the main gallery's "Default" pseudo-theme, not a real
 * THEMES entry -- see demo/components/theme-picker.tsx's DEFAULT_SWATCH)
 * rather than an
 * arbitrary real theme, so a first-time visitor with no stored preference
 * sees the exact same look index.ts's gallery shows by default -- and so
 * this stays correct even if THEMES gets reordered, instead of silently
 * tracking whatever entry happens to come first.
 */
const DEFAULT_THEME_KEY = ''

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

/**
 * Bundle `demo/diagram-type-client.tsx` (zombie-mermaid#805, replacing
 * `demo/diagram-page-client.ts`) for the browser. `minify: true`, unlike
 * the file it replaces: this is the first bundle on this page to include
 * `react`/`react-dom` (for `DiagramTypeApp`'s hydration) — see
 * `dashboard.ts`'s `bundleDashboardClient()` doc comment for why a bundle
 * with those two gets minified while a smaller, React-free one (like the
 * old `diagram-page-client.ts`) doesn't need to be.
 */
async function bundleDiagramTypeClient(): Promise<string> {
  return bundleForBrowser(
    new URL('./demo/diagram-type-client.tsx', import.meta.url).pathname,
    { minify: true },
  )
}

/** Bundle `demo/diagram-hub-client.tsx` (zombie-mermaid#805) for the
 * browser — mirrors `bundleDiagramTypeClient()`'s reasoning; this page has
 * no live diagram to re-theme, so its bundle is much smaller. */
async function bundleDiagramHubClient(): Promise<string> {
  return bundleForBrowser(
    new URL('./demo/diagram-hub-client.tsx', import.meta.url).pathname,
    { minify: true },
  )
}

/**
 * Bundle `demo/diagram-detail-client.tsx` (zombie-mermaid#989) for the
 * browser — written once to `assets/diagram-detail-client.js` and reused
 * as an external `<script src>` across every generated sample page (see
 * `diagram-page.tsx`'s `DiagramDetailPageProps.clientScriptSrc` doc
 * comment for why that's an external asset rather than inlined per page).
 */
async function bundleDiagramDetailClient(): Promise<string> {
  return bundleForBrowser(
    new URL('./demo/diagram-detail-client.tsx', import.meta.url).pathname,
    { minify: true },
  )
}

async function main(): Promise<void> {
  // Copy the demo's full stylesheet plus this page type's own small
  // supplement, same two-file split dashboard.ts already uses (dashboard.css
  // on top of styles.css) — gets every design token, shadow-* utility, and
  // .theme-pill/.theme-bar rule "for free" instead of re-deriving them, so a
  // diagram page's chrome matches the main demo's exactly, not approximately.
  const [demoCss, pageCss] = await Promise.all([
    readFile(new URL('./demo/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('./demo/diagram-page.css', import.meta.url), 'utf8'),
  ])
  await generatePage({
    outPath: new URL('./assets/diagram-page.css', OUT_DIR),
    content: `${demoCss}\n${pageCss}`,
    log: false,
  })

  const [clientJs, hubClientScript, detailClientJs] = await Promise.all([
    bundleDiagramTypeClient(),
    bundleDiagramHubClient(),
    bundleDiagramDetailClient(),
  ])
  await generatePage({
    outPath: new URL('./assets/diagram-page-client.js', OUT_DIR),
    content: clientJs,
    log: false,
  })
  await generatePage({
    outPath: new URL('./assets/diagram-detail-client.js', OUT_DIR),
    content: detailClientJs,
    log: false,
  })

  // The ASCII counterpart of DEFAULT_SWATCH's SVG rendering below --
  // colorMode: 'html' + diagramColorsToAsciiTheme() is the same
  // per-role-colored technique index-page.tsx's theme showcase uses (see
  // that file's themeShowcaseAsciiHtmlByTheme doc comment), computed once
  // here since DEFAULT_SWATCH never varies per type or sample.
  const detailAsciiTheme = diagramColorsToAsciiTheme(DEFAULT_SWATCH)

  // 'github-dark', not the other generators' 'github-light': every type
  // detail page (demo/components/diagram-page.tsx's `DiagramTypePage`) now
  // renders on the #590 redesign's fixed dark palette, and the source
  // panel's own CSS forces shiki's inline background transparent (see
  // diagram-page.tsx's `pageCss`) so only its text-token colors show --
  // those need to be the dark-theme set to read against a dark card.
  const highlighter = await createHighlighter({
    langs: ['mermaid'],
    themes: ['github-dark'],
  })

  // Include the '' (Default) pseudo-theme alongside the real THEMES entries
  // so demo/diagram-type-client.tsx can look it up like any other theme key
  // -- e.g. if a visitor switches to another theme and back to Default, or
  // if a theme picked on the main gallery (which does use '' for its own
  // Default pill) needs restoring here.
  const themesJson = escapeJsonForScriptTag(
    JSON.stringify({ '': DEFAULT_SWATCH, ...THEMES }),
  )

  const sitemapUrls: string[] = [`${SITE_URL}/`, `${SITE_URL}/editor`]

  const typeLinks = DIAGRAM_TYPE_PROFILES.map((p) => ({
    slug: p.slug,
    label: p.label,
    accent: p.accent,
  }))

  for (const profile of DIAGRAM_TYPE_PROFILES) {
    const colors = DEFAULT_SWATCH

    const renderDiagram = (
      source: string,
      extra: Pick<RenderOptions, 'direction'> = {},
    ): string =>
      renderMermaidSVG(source, {
        ...colors,
        title: `${profile.label} diagram, Zombie Mermaid`,
        interactivity: 'none',
        ...extra,
      })

    const highlightSource = (source: string): string => {
      const fenced = '```mermaid\n' + source.trim() + '\n```'
      const highlightedHtml = highlighter.codeToHtml(fenced, {
        lang: 'mermaid',
        theme: 'github-dark',
      })
      return stripShikiFenceLines(highlightedHtml)
    }

    // A wide (LR/RL) flowchart or state diagram gets a TD alternate for
    // narrow viewports — the same orientation swap the main gallery's own
    // samples use (demo/client.ts's renderSvgVariants), just pre-rendered
    // at build time here instead of live in the browser. Both variants are
    // pure static markup, picked between by demo/styles.css's
    // `.orientation-variant` media query (bundled into this page's own
    // stylesheet below) — no client JS needed to display the right one.
    // The narrow SVG is the unmodified source under the library's
    // `direction` override (issue #276); `narrowSource` (the rewritten
    // text) is only for the source panel shown alongside it. See
    // demo/diagram-orientation.ts's header comment.
    const directionLine = wideDiagramDirectionLine(profile.source)
    const narrowSource =
      directionLine !== null
        ? withNarrowDirection(profile.source, directionLine)
        : null

    const diagramMarkup: OrientationVariants =
      narrowSource === null
        ? renderDiagram(profile.source)
        : {
            wide: withUniqueSvgIds(
              renderDiagram(profile.source),
              `${profile.slug}-w-`,
            ),
            narrow: withUniqueSvgIds(
              renderDiagram(profile.source, { direction: NARROW_DIRECTION }),
              `${profile.slug}-n-`,
            ),
          }

    const sourcePanelMarkup: OrientationVariants =
      narrowSource === null
        ? highlightSource(profile.source)
        : {
            wide: highlightSource(profile.source),
            narrow: highlightSource(narrowSource),
          }

    const title = `${profile.label} examples | Zombie Mermaid`
    const description = `${profile.intro} Rendered live in any of ${Object.keys(THEMES).length} built-in themes — free, open source, and dependency-free.`
    const canonical = `${SITE_URL}/diagrams/${profile.slug}.html`
    sitemapUrls.push(canonical)

    // Memoizes renderDiagram(sample.source) by sample title within this
    // type: a sample can be rendered once here for `galleryItems`/its own
    // detail page and again as another sample's "More <type> examples"
    // crosslink thumbnail below — caching avoids re-running the renderer
    // for the same source twice.
    const svgCache = new Map<string, string>()
    const cachedSvg = (sample: Sample): string => {
      const cached = svgCache.get(sample.title)
      if (cached !== undefined) return cached
      const html = renderDiagram(sample.source)
      svgCache.set(sample.title, html)
      return html
    }

    // Every real sample for this type — not gated by sample.gallery, per
    // allExamplesFor's own doc comment (docs/decisions/diagram-tag-
    // search.md's Context section records that decision). Backs both the
    // type page's "More examples" section (#989's part 2) and the
    // specific-diagram detail pages generated below (#989's part 1).
    const allSamples = allExamplesFor(profile.slug)

    // "More examples" section: every real sample, each rendered once at the
    // default theme/direction and linking to its own detail page below —
    // these are small thumbnails (demo/components/diagram-page.tsx's
    // `MoreExamplesSection` letterboxes them into a fixed-aspect frame), not
    // the page's primary orientation-swapping "Source → render" diagram, so
    // unlike `diagramMarkup` above they get no narrow-viewport variant. The
    // section's own `<details>` disclosure (unchanged) keeps this bounded
    // regardless of a type's real sample count (4-24) — see
    // MoreExamplesSection's doc comment.
    const galleryItems = allSamples.map((sample) => ({
      title: sample.title,
      diagramHtml: cachedSvg(sample),
      href: `${profile.slug}/${sampleSlug(sample.title)}.html`,
    }))

    // -- Specific-diagram detail pages (#989's part 1): one per real sample
    // of this type, e.g. diagrams/flowchart/ci-cd-pipeline.html.
    for (const sample of allSamples) {
      const sampleUrlSlug = sampleSlug(sample.title)
      const detailCanonical = `${SITE_URL}/diagrams/${profile.slug}/${sampleUrlSlug}.html`
      sitemapUrls.push(detailCanonical)

      // Capped at 6, matching MoreExamplesSection's own desktop cap on the
      // type page — not every other sample of a 24-strong type inlined on
      // every one of its own detail pages.
      const moreFromType: DiagramDetailCrosslink[] = allSamples
        .filter((other) => other.title !== sample.title)
        .slice(0, 6)
        .map((other) => ({
          title: other.title,
          href: `./${sampleSlug(other.title)}.html`,
          diagramHtml: cachedSvg(other),
        }))

      const detailHtml = renderHtmlDocument(
        createElement(DiagramDetailPage, {
          typeLabel: profile.label,
          typeHref: `../${profile.slug}.html`,
          accent: profile.accent,
          sampleTitle: sample.title,
          sampleDescription: sample.description,
          sourceFilename: `${sampleUrlSlug}.mmd`,
          sourceHtml: highlightSource(sample.source),
          svgHtml: cachedSvg(sample),
          asciiHtml: renderMermaidASCII(sample.source, {
            colorMode: 'html',
            theme: detailAsciiTheme,
          }).replace(/[ \t]+$/gm, ''),
          editorHref: `../../editor#${editorHash(sample.source, DEFAULT_THEME_KEY)}`,
          moreFromType,
          title: `${sample.title} | ${profile.label} diagram | Zombie Mermaid`,
          description: `${sample.description} Rendered live as both SVG and ASCII by zombie-mermaid, free and open source.`,
          canonical: detailCanonical,
          faviconHref: '../../favicon.svg',
          cssHref: '../assets/diagram-page.css',
          clientScriptSrc: '../assets/diagram-detail-client.js',
        }),
      )

      await generatePage({
        outPath: new URL(`./${profile.slug}/${sampleUrlSlug}.html`, OUT_DIR),
        content: detailHtml,
        log: false,
      })
    }

    const sourceJson = escapeJsonForScriptTag(JSON.stringify(profile.source))
    const narrowSourceJson = escapeJsonForScriptTag(
      JSON.stringify(narrowSource),
    )
    const themeDataScript = `window.__diagramPageThemes = ${themesJson}; window.__diagramPageSource = ${sourceJson}; window.__diagramPageNarrowSource = ${narrowSourceJson};`

    // The type page's own hero diagram, in the ASCII toggle state (#989's
    // part 2) — always the wide/default orientation, unlike diagramMarkup
    // above: ASCII text degrades to horizontal scroll on a narrow viewport
    // (ASCII_OUTPUT_STYLE's overflowX), it doesn't overflow the layout the
    // way an un-narrowed wide SVG would, so a second orientation-swapped
    // render isn't needed here the way it is for diagramMarkup/sourcePanelMarkup.
    const typeAsciiHtml = renderMermaidASCII(profile.source, {
      colorMode: 'html',
      theme: detailAsciiTheme,
    }).replace(/[ \t]+$/gm, '')

    const html = renderHtmlDocument(
      createElement(DiagramTypePage, {
        label: profile.label,
        slug: profile.slug,
        intro: profile.intro,
        accent: profile.accent,
        exampleHeading: profile.exampleHeading,
        sourceFilename: profile.sourceFilename,
        title,
        description,
        canonical,
        cssHref: 'assets/diagram-page.css',
        faviconHref: '../favicon.svg',
        sourcePanelHtml: sourcePanelMarkup,
        diagramHtml: diagramMarkup,
        asciiHtml: typeAsciiHtml,
        editorHref: `../editor#${editorHash(profile.source, DEFAULT_THEME_KEY)}`,
        galleryItems,
        types: typeLinks,
        themeDataScript,
        clientScriptSrc: 'assets/diagram-page-client.js',
      }),
    )

    await generatePage({
      outPath: new URL(`./${profile.slug}.html`, OUT_DIR),
      content: html,
      log: false,
    })
  }

  // -- Hub page: diagrams/index.html, listing every generated type page --
  const hubCanonical = `${SITE_URL}/diagrams/`
  sitemapUrls.push(hubCanonical)

  const hubHtml = renderHtmlDocument(
    createElement(DiagramHubPage, {
      title: `Diagram gallery: every type | Zombie Mermaid`,
      description: `Browse every zombie-mermaid diagram type: ${DIAGRAM_TYPE_PROFILES.map((p) => p.label).join(', ')} — each rendered live in any of ${Object.keys(THEMES).length} built-in themes including Nord, Dracula, Tokyo Night, and GitHub.`,
      canonical: hubCanonical,
      cssHref: 'assets/diagram-page.css',
      faviconHref: '../favicon.svg',
      themeCount: Object.keys(THEMES).length,
      types: DIAGRAM_TYPE_PROFILES.map((profile) => ({
        slug: profile.slug,
        label: profile.label,
        intro: profile.intro,
        accent: profile.accent,
      })),
      clientScript: hubClientScript,
    }),
  )

  await generatePage({
    outPath: new URL('./index.html', OUT_DIR),
    content: hubHtml,
    log: false,
  })

  // -- sitemap.xml --
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`).join('\n')}
</urlset>
`
  await generatePage({
    outPath: new URL('./sitemap.xml', siteOutDir(import.meta.url)),
    content: sitemap,
    log: false,
  })

  console.log(
    `Wrote ${DIAGRAM_TYPE_PROFILES.length} diagram pages + hub page + sitemap.xml (${sitemapUrls.length} URLs) to ${OUT_DIR.pathname}`,
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exitCode = 1
})
