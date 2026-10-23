/**
 * Diagram routes: hub, per-type, per-sample detail, tag pages, all.html and
 * the shared css/js assets. Ported from the former packages/site/pages.ts
 * (see its header for the design rationale: one page per type, live theme
 * picker, pre-rendered SVG + ASCII).
 */
import { readFile } from 'node:fs/promises'
import { createElement } from 'react'
import { createHighlighter } from 'shiki'
import { THEMES } from '@zombie-mermaid/core'
import { diagramColorsToAsciiTheme } from '@zombie-mermaid/ascii-renderer'
import { escapeJsonForScriptTag, stripShikiFenceLines } from '../../../demo/format.ts'
import { renderHtmlDocument } from '../../../demo/render-html.ts'
import {
  DiagramAllPage,
  DiagramDetailPage,
  DiagramHubPage,
  DiagramTagPage,
  DiagramTypePage,
  type DiagramAllTypeSection,
  type DiagramDetailCrosslink,
  type OrientationVariants,
  type TagResultItem,
} from '../../../demo/components/diagram-page.tsx'
import {
  DIAGRAM_TYPE_PROFILES,
  allExamplesFor,
  sampleSlug,
} from '../../../demo/diagram-pages-data.ts'
import { TAG_RULES } from '../../../demo/diagram-tags.ts'
import { DEFAULT_SWATCH } from '../../../demo/components/theme-picker.tsx'
import {
  wideDiagramDirectionLine,
  withNarrowDirection,
  NARROW_DIRECTION,
  withUniqueSvgIds,
} from '../../../demo/diagram-orientation.ts'
import { renderMermaidASCII, renderMermaidSVG } from '../../../src/index.ts'
import type { RenderOptions } from '../../../src/index.ts'
import type { Sample } from '../samples-data.ts'
import { SITE_URL, type Clients, type Routes } from './shared.ts'

/** Every page renders with '' (the "Default" pseudo-theme, see theme-picker.tsx's DEFAULT_SWATCH) first. */
const DEFAULT_THEME_KEY = ''

/**
 * The URL hash the live editor (editor/js/sharing.js's `getHashSource`) reads:
 * `#` + base64(JSON.stringify({source, theme})).
 */
function editorHash(source: string, theme: string): string {
  return Buffer.from(JSON.stringify({ source, theme }), 'utf-8').toString(
    'base64',
  )
}

const read = (rel: string) =>
  readFile(new URL(`../../../${rel}`, import.meta.url), 'utf8')

export async function diagramRoutes(
  c: Clients,
  out: Routes,
  sitemapUrls: string[],
): Promise<void> {
  const [demoCss, pageCss] = await Promise.all([
    read('demo/styles.css'),
    read('demo/diagram-page.css'),
  ])
  out.set('diagrams/assets/diagram-page.css', `${demoCss}\n${pageCss}`)
  out.set('diagrams/assets/diagram-page-client.js', c['diagram-type-client']!)
  out.set(
    'diagrams/assets/diagram-detail-client.js',
    c['diagram-detail-client']!,
  )
  out.set('diagrams/assets/diagram-tag-client.js', c['diagram-tag-client']!)

  // ASCII counterpart of DEFAULT_SWATCH, computed once (never varies).
  const detailAsciiTheme = diagramColorsToAsciiTheme(DEFAULT_SWATCH)

  // 'github-dark': the type pages render on the redesign's fixed dark palette.
  const highlighter = await createHighlighter({
    langs: ['mermaid'],
    themes: ['github-dark'],
  })

  // '' (Default) alongside the real THEMES so the client can look it up.
  const themesJson = escapeJsonForScriptTag(
    JSON.stringify({ '': DEFAULT_SWATCH, ...THEMES }),
  )

  const typeLinks = DIAGRAM_TYPE_PROFILES.map((p) => ({
    slug: p.slug,
    label: p.label,
    accent: p.accent,
  }))

  // Every sample with its rendered SVG and detail href (relative to
  // diagrams/), for the cross-type tag and view-all pages.
  const allSamplesFlat: {
    sample: Sample
    profile: (typeof DIAGRAM_TYPE_PROFILES)[number]
    svgHtml: string
    href: string
  }[] = []

  const html = (el: Parameters<typeof renderHtmlDocument>[0]) =>
    renderHtmlDocument(el)

  for (const profile of DIAGRAM_TYPE_PROFILES) {
    const renderDiagram = (
      source: string,
      extra: Pick<RenderOptions, 'direction'> = {},
    ): string =>
      renderMermaidSVG(source, {
        ...DEFAULT_SWATCH,
        title: `${profile.label}, Zombie Mermaid`,
        interactivity: 'none',
        ...extra,
      })

    const highlightSource = (source: string): string =>
      stripShikiFenceLines(
        highlighter.codeToHtml('```mermaid\n' + source.trim() + '\n```', {
          lang: 'mermaid',
          theme: 'github-dark',
        }),
      )

    // A wide (LR/RL) flowchart/state diagram gets a pre-rendered TD alternate
    // for narrow viewports (demo/diagram-orientation.ts); the CSS picks one.
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

    const canonical = `${SITE_URL}/diagrams/${profile.slug}.html`
    sitemapUrls.push(canonical)

    // A sample can be rendered for the gallery/its own page and again as
    // another sample's crosslink thumbnail; cache by title within a type.
    const svgCache = new Map<string, string>()
    const cachedSvg = (sample: Sample): string => {
      const cached = svgCache.get(sample.title)
      if (cached !== undefined) return cached
      const svg = renderDiagram(sample.source)
      svgCache.set(sample.title, svg)
      return svg
    }

    // Every real sample (not gated by sample.gallery, per allExamplesFor).
    const allSamples = allExamplesFor(profile.slug)
    const galleryItems = allSamples.map((sample) => ({
      title: sample.title,
      diagramHtml: cachedSvg(sample),
      href: `${profile.slug}/${sampleSlug(sample.title)}.html`,
    }))
    allSamples.forEach((sample, i) => {
      const item = galleryItems[i]
      if (!item) return
      allSamplesFlat.push({
        sample,
        profile,
        svgHtml: item.diagramHtml,
        href: `../${item.href}`,
      })
    })

    // Detail pages: one per real sample, e.g. diagrams/flowchart/ci-cd-pipeline.html.
    for (const sample of allSamples) {
      const sampleUrlSlug = sampleSlug(sample.title)
      const detailCanonical = `${SITE_URL}/diagrams/${profile.slug}/${sampleUrlSlug}.html`
      sitemapUrls.push(detailCanonical)

      // Capped at 6, matching MoreExamplesSection's own desktop cap.
      const moreFromType: DiagramDetailCrosslink[] = allSamples
        .filter((other) => other.title !== sample.title)
        .slice(0, 6)
        .map((other) => ({
          title: other.title,
          href: `./${sampleSlug(other.title)}.html`,
          diagramHtml: cachedSvg(other),
        }))

      out.set(
        `diagrams/${profile.slug}/${sampleUrlSlug}.html`,
        html(
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
            tags: TAG_RULES.filter((rule) => rule.test(sample)).map((rule) => ({
              label: rule.label,
              href: `../tag/${rule.slug}.html`,
            })),
            title: `${sample.title} | ${profile.label} | Zombie Mermaid`,
            description: `${sample.description} Rendered live as both SVG and ASCII by zombie-mermaid, free and open source.`,
            canonical: detailCanonical,
            faviconHref: '../../favicon.svg',
            cssHref: '../assets/diagram-page.css',
            clientScriptSrc: '../assets/diagram-detail-client.js',
          }),
        ),
      )
    }

    const themeDataScript = `window.__diagramPageThemes = ${themesJson}; window.__diagramPageSource = ${escapeJsonForScriptTag(JSON.stringify(profile.source))}; window.__diagramPageNarrowSource = ${escapeJsonForScriptTag(JSON.stringify(narrowSource))};`

    // The ASCII toggle state is always the wide orientation (it scrolls, it doesn't overflow).
    const typeAsciiHtml = renderMermaidASCII(profile.source, {
      colorMode: 'html',
      theme: detailAsciiTheme,
    }).replace(/[ \t]+$/gm, '')

    out.set(
      `diagrams/${profile.slug}.html`,
      html(
        createElement(DiagramTypePage, {
          label: profile.label,
          slug: profile.slug,
          intro: profile.intro,
          accent: profile.accent,
          exampleHeading: profile.exampleHeading,
          sourceFilename: profile.sourceFilename,
          aboutHeading: profile.aboutHeading,
          about: profile.about,
          docsUrl: profile.docsUrl,
          title: `${profile.label} examples | Zombie Mermaid`,
          description: `${profile.intro} Rendered live in any of ${Object.keys(THEMES).length} built-in themes — free, open source, and dependency-free.`,
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
      ),
    )
  }

  // Single-tag search pages: one per TAG_RULES entry with at least one real
  // match (docs/decisions/diagram-tag-search.md, "real matches only").
  for (const rule of TAG_RULES) {
    const matches = allSamplesFlat.filter((entry) => rule.test(entry.sample))
    if (matches.length === 0) continue

    const tagCanonical = `${SITE_URL}/diagrams/tag/${rule.slug}.html`
    sitemapUrls.push(tagCanonical)

    const results: TagResultItem[] = matches.map((entry) => ({
      title: entry.sample.title,
      typeLabel: entry.profile.label,
      typeAccent: entry.profile.accent,
      href: entry.href,
      diagramHtml: entry.svgHtml,
    }))

    out.set(
      `diagrams/tag/${rule.slug}.html`,
      html(
        createElement(DiagramTagPage, {
          label: rule.label,
          description: rule.description,
          docsUrl: rule.docsUrl,
          results,
          title: `${rule.label} — Mermaid diagram examples | Zombie Mermaid`,
          metaDescription: `${rule.description} ${results.length} real example${results.length === 1 ? '' : 's'} across every zombie-mermaid diagram type.`,
          canonical: tagCanonical,
          faviconHref: '../../favicon.svg',
          cssHref: '../assets/diagram-page.css',
          clientScriptSrc: '../assets/diagram-tag-client.js',
        }),
      ),
    )
  }

  // View-all page: every sample grouped by type, in DIAGRAM_TYPE_PROFILES order.
  const allCanonical = `${SITE_URL}/diagrams/all.html`
  sitemapUrls.push(allCanonical)

  const allSections: DiagramAllTypeSection[] = DIAGRAM_TYPE_PROFILES.map(
    (profile) => ({
      slug: profile.slug,
      label: profile.label,
      accent: profile.accent,
      items: allSamplesFlat
        .filter((entry) => entry.profile.slug === profile.slug)
        .map((entry) => ({
          title: entry.sample.title,
          diagramHtml: entry.svgHtml,
          href: `${profile.slug}/${sampleSlug(entry.sample.title)}.html`,
        })),
    }),
  )

  out.set(
    'diagrams/all.html',
    html(
      createElement(DiagramAllPage, {
        totalCount: allSamplesFlat.length,
        sections: allSections,
        title: `Every diagram, one scroll | Zombie Mermaid`,
        description: `All ${allSamplesFlat.length} real zombie-mermaid examples across every diagram type -- ${DIAGRAM_TYPE_PROFILES.map((p) => p.label).join(', ')} -- grouped by type on one page.`,
        canonical: allCanonical,
        cssHref: 'assets/diagram-page.css',
        faviconHref: '../favicon.svg',
        clientScript: c['diagram-all-client']!,
      }),
    ),
  )

  // Hub page: diagrams/index.html.
  const hubCanonical = `${SITE_URL}/diagrams/`
  sitemapUrls.push(hubCanonical)

  out.set(
    'diagrams/index.html',
    html(
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
          count: allExamplesFor(profile.slug).length,
        })),
        allHref: 'all.html',
        clientScript: c['diagram-hub-client']!,
      }),
    ),
  )
}
