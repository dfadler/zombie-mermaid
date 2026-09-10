/** @jsxRuntime automatic */
/**
 * The blog's post pages and index (blog.ts → blog/*.html) as React
 * components, rebuilt in the site redesign's visual system (#607, part of
 * #590/#591).
 *
 * As of zombie-mermaid#803, this file holds only the page *shells*
 * (`<html>`/`<head>`, the `NavIsland`/`Footer` sibling islands, the
 * hydration container/script wiring) — the hydrated content
 * (breadcrumb, hero, post body, featured/archive grid, ...) lives in
 * `blog-app.tsx`'s `BlogPostApp`/`BlogIndexApp`, split out specifically so
 * `demo/blog-post-client.tsx`/`demo/blog-index-client.tsx` (the browser
 * bundles) never need to import this file, and therefore never pull in
 * `react-dom/server` (used below for `renderToString`) into either client
 * bundle — see `blog-app.tsx`'s own header comment, and `dashboard-
 * app.tsx`'s (the pattern this mirrors) for the full rationale, including
 * why `<Footer>`/`<NavIsland>` render here as plain siblings rather than
 * nested inside either app's hydrated tree.
 *
 * blog.ts still parses the Markdown sources, renders them through marked +
 * shiki, and formats dates — only the post body arrives here as raw HTML.
 * Chrome comes from the shared Nav (#593) and Footer (#594) rather than
 * site-chrome.tsx's older `SiteHeader`/`SiteFooter`.
 *
 * Layout for the index (blog/index.html — featured post + archive grid) is
 * a faithful rebuild of the `Blog.dc.html` artboard in the design canvas
 * linked from #590 (`https://claude.ai/code/artifact/2f623662-…`) — see
 * `blog-app.tsx`'s `FeaturedVisual`/`FeaturedPost`/`ArchiveCard` for the
 * deliberate departures from that mockup (unchanged by #803).
 *
 * There is no mockup for the post-page template (`BlogPostApp`) — see
 * that function's own doc comment (`blog-app.tsx`) for the reasoning
 * behind its layout.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { escapeJsonForScriptTag } from '../format.ts'
import { FORK_URL, HOME_HREF } from './site-chrome.tsx'
import { Footer, type FooterColumn } from './footer.tsx'
import { NavMobileMenuScript, type NavKey } from './nav.tsx'
import { NavIsland } from './nav-island.tsx'
import { Document } from './document.tsx'
import {
  BLOG_DESCRIPTION,
  BLOG_INDEX_PROPS_ELEMENT_ID,
  BLOG_INDEX_ROOT_ID,
  BLOG_POST_PROPS_ELEMENT_ID,
  BLOG_POST_ROOT_ID,
  BlogIndexApp,
  BlogPostApp,
  type BlogIndexAppProps,
  type BlogPostAppProps,
  type BlogPostSummary,
} from './blog-app.tsx'
import { DesignFontLinks, colorVar } from './tokens.tsx'

// Re-exported for existing callers/tests that import these from
// blog-page.tsx rather than blog-app.tsx directly (this file was the sole
// home for all of them before the #803 split).
export {
  BLOG_DESCRIPTION,
  BLOG_INDEX_PROPS_ELEMENT_ID,
  BLOG_INDEX_ROOT_ID,
  BLOG_POST_PROPS_ELEMENT_ID,
  BLOG_POST_ROOT_ID,
  BlogIndexApp,
  BlogPostApp,
  type BlogIndexAppProps,
  type BlogPostAppProps,
  type BlogPostSummary,
} from './blog-app.tsx'

/**
 * Every blog page lives one directory below the site root
 * (blog/index.html, blog/<slug>.html), so the relative destinations below
 * are shared between {@link BlogIndexPage} and {@link BlogPostPage}.
 * `'blog'` points at `'./'` — the blog section's own hub — rather than
 * nav.tsx's `NAV_ITEMS` placeholder, since both page types already sit
 * inside blog/.
 */
const NAV_HREFS: Partial<Record<NavKey, string>> = {
  diagrams: '../diagrams/',
  editor: '../editor',
  forkFixes: '../fork-fixes.html',
  blog: './',
  github: FORK_URL,
}

/** {@link Footer}'s three link columns, with real destinations in place of
 * footer.tsx's `#anchor` mockup placeholders. Shared for the same reason
 * as {@link NAV_HREFS}. */
const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Diagrams', href: '../diagrams/' },
      { label: 'Editor', href: '../editor' },
      { label: 'Fork fixes', href: '../fork-fixes.html' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Blog', href: './' },
      { label: 'GitHub', href: FORK_URL },
      {
        label: 'npm package',
        href: 'https://www.npmjs.com/package/zombie-mermaid',
      },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'MIT Licensed' },
      { label: 'dfadler/zombie-mermaid', href: FORK_URL },
    ],
  },
]

/* -----------------------------------------------------------------
 * Document shell
 *
 * A page-local wrapper around the shared `Document` (document.tsx):
 * `Document` itself now owns the charset/viewport/title/description/
 * favicon boilerplate this used to hand-roll; `BlogDocument` supplies only
 * what's left — the canonical/Open Graph tags, DesignFontLinks (Space
 * Grotesk + Plus Jakarta Sans, not `site-chrome.tsx`'s `FontLinks`'s Geist +
 * JetBrains Mono), the page stylesheet, and the `<body>` background these
 * pages have always set.
 *
 * `Document`'s favicon `<link>` now renders right after the description
 * meta tag rather than after these Open Graph/Twitter tags, where it used
 * to sit — a `<head>`-internal reordering with no rendering/SEO effect, not
 * a behavior change (see document.tsx's own doc comment).
 * ----------------------------------------------------------------- */

interface BlogDocumentProps {
  title: string
  description: string
  canonical: string
  cssHref: string
  faviconHref: string
  ogType?: string
  publishedTime?: string
  children: ReactNode
}

function BlogDocument({
  title,
  description,
  canonical,
  cssHref,
  faviconHref,
  ogType = 'website',
  publishedTime,
  children,
}: BlogDocumentProps) {
  return (
    <Document
      title={title}
      description={description}
      faviconHref={faviconHref}
      bodyStyle={{ background: colorVar('--bg') }}
      head={
        <>
          <link rel="canonical" href={canonical} />
          <meta property="og:title" content={title} />
          <meta property="og:description" content={description} />
          <meta property="og:type" content={ogType} />
          <meta property="og:url" content={canonical} />
          {ogType === 'article' && publishedTime ? (
            <meta property="article:published_time" content={publishedTime} />
          ) : null}
          <meta name="twitter:card" content="summary" />
          <DesignFontLinks />
          <link rel="stylesheet" href={cssHref} />
        </>
      }
    >
      {children}
    </Document>
  )
}

/* -----------------------------------------------------------------
 * Post page
 * ----------------------------------------------------------------- */

export interface BlogPostPageProps {
  title: string
  /** Already formatted for display, e.g. "March 4, 2026". */
  displayDate: string
  description: string
  canonical: string
  cssHref: string
  faviconHref: string
  /** ISO date, emitted as `article:published_time`. */
  publishedTime: string
  /** The post body, rendered from Markdown by marked + shiki. */
  bodyHtml: string
  /**
   * The bundled `demo/blog-post-client.tsx` entry (zombie-mermaid#803)
   * that hydrates {@link BlogPostApp} and `<NavIsland>` (via
   * `hydrateNav()` — mirroring `dashboard-client.tsx`'s exact pattern: one
   * bundle for both, rather than a separate `nav-only-client.tsx` bundle
   * paying for its own copy of `react`/`react-dom` on top of this one).
   * Defaults to `''` (no hydration script at all — SSR-only), matching
   * every other page's `clientScript` default.
   */
  clientScript?: string
}

/** One blog post, e.g. blog/shipping-v1-of-a-zombie.html. */
export function BlogPostPage({
  title,
  displayDate,
  description,
  canonical,
  cssHref,
  faviconHref,
  publishedTime,
  bodyHtml,
  clientScript = '',
}: BlogPostPageProps) {
  const appProps: BlogPostAppProps = { title, displayDate, bodyHtml }
  return (
    <BlogDocument
      title={`${title} | Zombie Mermaid Blog`}
      description={description}
      canonical={canonical}
      cssHref={cssHref}
      faviconHref={faviconHref}
      ogType="article"
      publishedTime={publishedTime}
    >
      <div
        style={{
          background: `linear-gradient(180deg, ${colorVar('--bg')} 0%, ${colorVar(
            '--bg-soft',
          )} 40%, ${colorVar('--bg')} 100%)`,
        }}
      >
        <NavIsland
          sticky
          active="blog"
          homeHref={HOME_HREF}
          hrefs={NAV_HREFS}
          installSlotKind="empty"
        />

        {/*
          Plain, inert hydration container -- see dashboard-app.tsx's
          DASHBOARD_ROOT_ID doc comment for why BlogPostApp's own root
          can't carry this id itself, and dashboard-page.tsx's own, more
          detailed version of this comment (the pattern this mirrors) for
          why renderToString (not renderToStaticMarkup) is needed here.
        */}
        <div
          id={BLOG_POST_ROOT_ID}
          dangerouslySetInnerHTML={{
            // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this page's own BlogPostApp component tree rendered via renderToString (see the comment above); never user input
            __html: renderToString(<BlogPostApp {...appProps} />),
          }}
        />
        <script
          type="application/json"
          id={BLOG_POST_PROPS_ELEMENT_ID}
          dangerouslySetInnerHTML={{
            // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time JSON from this page's own BlogPostAppProps, escaped with escapeJsonForScriptTag; never user input
            __html: escapeJsonForScriptTag(JSON.stringify(appProps)),
          }}
        />

        <Footer columns={FOOTER_COLUMNS} />
        <script
          type="module"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own demo/blog-post-client.tsx bundle, under version control and produced at build time; never live/runtime user input
          dangerouslySetInnerHTML={{ __html: clientScript }}
        />
        <NavMobileMenuScript />
      </div>
    </BlogDocument>
  )
}

/* -----------------------------------------------------------------
 * Index page
 * ----------------------------------------------------------------- */

export interface BlogIndexPageProps {
  canonical: string
  cssHref: string
  faviconHref: string
  posts: readonly BlogPostSummary[]
  /**
   * The bundled `demo/blog-index-client.tsx` entry (zombie-mermaid#803)
   * that hydrates {@link BlogIndexApp} and `<NavIsland>` — see {@link
   * BlogPostPageProps.clientScript}'s doc comment for the identical
   * reasoning. Defaults to `''`, matching that prop's default.
   */
  clientScript?: string
}

/** blog/index.html — the featured post plus the archive grid, newest first. */
export function BlogIndexPage({
  canonical,
  cssHref,
  faviconHref,
  posts,
  clientScript = '',
}: BlogIndexPageProps) {
  const appProps: BlogIndexAppProps = { posts }
  return (
    <BlogDocument
      title="Blog | Zombie Mermaid"
      description={BLOG_DESCRIPTION}
      canonical={canonical}
      cssHref={cssHref}
      faviconHref={faviconHref}
    >
      <div
        style={{
          background: `linear-gradient(180deg, ${colorVar('--bg')} 0%, ${colorVar(
            '--bg-soft',
          )} 40%, ${colorVar('--bg')} 100%)`,
        }}
      >
        <NavIsland
          sticky
          active="blog"
          homeHref={HOME_HREF}
          hrefs={NAV_HREFS}
          installSlotKind="empty"
        />

        {/*
          Plain, inert hydration container -- see BlogPostPage's identical
          comment above.
        */}
        <div
          id={BLOG_INDEX_ROOT_ID}
          dangerouslySetInnerHTML={{
            // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this page's own BlogIndexApp component tree rendered via renderToString (see the comment above); never user input
            __html: renderToString(<BlogIndexApp {...appProps} />),
          }}
        />
        <script
          type="application/json"
          id={BLOG_INDEX_PROPS_ELEMENT_ID}
          dangerouslySetInnerHTML={{
            // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time JSON from this page's own BlogIndexAppProps, escaped with escapeJsonForScriptTag; never user input
            __html: escapeJsonForScriptTag(JSON.stringify(appProps)),
          }}
        />

        <Footer columns={FOOTER_COLUMNS} />
        <script
          type="module"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own demo/blog-index-client.tsx bundle, under version control and produced at build time; never live/runtime user input
          dangerouslySetInnerHTML={{ __html: clientScript }}
        />
        <NavMobileMenuScript />
      </div>
    </BlogDocument>
  )
}
