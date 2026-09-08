/** @jsxRuntime automatic */
/**
 * The per-diagram-type SEO pages and their hub page (pages.ts →
 * diagrams/*.html) as React components — part of #589's move of every site
 * generator off template-literal HTML.
 *
 * Pure functions of already-computed data: pages.ts still owns the I/O and
 * the rendering work (renderMermaidSVG, shiki, esbuild), and hands the
 * results here. The two places raw HTML is spliced in — the rendered SVG
 * and shiki's highlighted source — are strings this repo's own renderer
 * produced at build time, never user input; each carries the wrapper
 * element's class itself so no extra layout-breaking `<div>` is introduced.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { ReactNode } from 'react'
import { BreadcrumbSep, PageShell, StaticPage } from './site-chrome.tsx'

/**
 * A block that either has one rendering, or a wide/narrow pair swapped by
 * demo/styles.css's `.orientation-variant` media query (see
 * demo/diagram-orientation.ts).
 */
export type OrientationVariants = { wide: string; narrow: string } | string

function OrientationBlock({
  className,
  html,
}: {
  className: string
  html: OrientationVariants
}) {
  if (typeof html === 'string') {
    // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time renderMermaidSVG/shiki output, never user input (see the file header)
    return (
      <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
    )
  }
  return (
    <div className={className}>
      <div
        className="orientation-variant orientation-wide"
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time renderMermaidSVG/shiki output, never user input (see the file header)
        dangerouslySetInnerHTML={{ __html: html.wide }}
      />
      <div
        className="orientation-variant orientation-narrow"
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time renderMermaidSVG/shiki output, never user input (see the file header)
        dangerouslySetInnerHTML={{ __html: html.narrow }}
      />
    </div>
  )
}

export interface DiagramTypeLink {
  slug: string
  label: string
}

/** The "Other diagram types" grid, with the page's own type marked current. */
export function OtherTypesGrid({
  types,
  currentSlug,
}: {
  types: readonly DiagramTypeLink[]
  currentSlug: string
}) {
  return (
    <div className="link-grid">
      {types.map((type) => (
        <a
          key={type.slug}
          className={`link-grid-item${type.slug === currentSlug ? ' is-current' : ''}`}
          href={`${type.slug}.html`}
        >
          {type.label}
        </a>
      ))}
    </div>
  )
}

export interface DiagramTypePageProps {
  label: string
  slug: string
  intro: string
  title: string
  description: string
  canonical: string
  cssHref: string
  faviconHref: string
  /** shiki-highlighted Mermaid source, one or two orientation variants. */
  sourcePanelHtml: OrientationVariants
  /** The rendered SVG, one or two orientation variants. */
  diagramHtml: OrientationVariants
  /** `../editor#<base64 payload>` — see pages.ts's `editorHash`. */
  editorHref: string
  types: readonly DiagramTypeLink[]
  themePills: ReactNode
  /** The inline `<script>` seeding `window.__diagramPage*`, already escaped. */
  themeDataScript: string
  clientScriptSrc: string
}

/** One diagram-type landing page, e.g. diagrams/flowchart.html. */
export function DiagramTypePage({
  label,
  slug,
  intro,
  title,
  description,
  canonical,
  cssHref,
  faviconHref,
  sourcePanelHtml,
  diagramHtml,
  editorHref,
  types,
  themePills,
  themeDataScript,
  clientScriptSrc,
}: DiagramTypePageProps) {
  return (
    <StaticPage
      title={title}
      description={description}
      canonical={canonical}
      cssHref={cssHref}
      faviconHref={faviconHref}
      bodyScript={
        <>
          <script
            // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time JSON from DIAGRAM_TYPE_PROFILES, escaped with escapeJsonForScriptTag; never user input
            dangerouslySetInnerHTML={{ __html: themeDataScript }}
          />
          <script type="module" src={clientScriptSrc} />
        </>
      }
    >
      <PageShell
        homeHref="../"
        themePills={themePills}
        breadcrumb={
          <>
            <a href="../">Home</a>
            <BreadcrumbSep />
            <a href="./">Diagrams</a>
            <BreadcrumbSep />
            {label}
          </>
        }
      >
        <h1>{label} examples</h1>
        <p className="lede">{intro}</p>

        <div className="diagram-layout">
          <div className="source-column">
            <h2 className="source-heading">Mermaid source</h2>
            <OrientationBlock className="source-panel" html={sourcePanelHtml} />
          </div>
          <div className="diagram-column">
            <OrientationBlock className="diagram-frame" html={diagramHtml} />
          </div>
        </div>

        <div className="cta-row">
          <a className="cta-btn primary" href={editorHref}>
            Open in the live editor
          </a>
          <a className="cta-btn" href="../#samples-heading">
            See all samples
          </a>
        </div>

        <div className="section">
          <h2>Other diagram types</h2>
          <OtherTypesGrid types={types} currentSlug={slug} />
        </div>
      </PageShell>
    </StaticPage>
  )
}

export interface DiagramHubPageProps {
  title: string
  description: string
  canonical: string
  cssHref: string
  faviconHref: string
  themeCount: number
  types: ReadonlyArray<DiagramTypeLink & { intro: string }>
}

/** diagrams/index.html — the hub listing every generated type page. */
export function DiagramHubPage({
  title,
  description,
  canonical,
  cssHref,
  faviconHref,
  themeCount,
  types,
}: DiagramHubPageProps) {
  return (
    <StaticPage
      title={title}
      description={description}
      canonical={canonical}
      cssHref={cssHref}
      faviconHref={faviconHref}
    >
      <PageShell
        homeHref="../"
        breadcrumb={
          <>
            <a href="../">Home</a>
            <BreadcrumbSep />
            Diagrams
          </>
        }
      >
        <h1>Every diagram type</h1>
        <p className="lede">
          zombie-mermaid renders {types.length} Mermaid diagram types, each with
          a live picker across every one of its {themeCount} built-in themes.
          Pick a diagram type below.
        </p>
        {types.map((type) => (
          <section className="type-group" key={type.slug}>
            <h2>
              <a href={`${type.slug}.html`}>{type.label}</a>
            </h2>
            <p className="type-intro">{type.intro}</p>
          </section>
        ))}
      </PageShell>
    </StaticPage>
  )
}
