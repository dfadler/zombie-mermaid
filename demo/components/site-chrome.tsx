/** @jsxRuntime automatic */
/**
 * Shared site chrome as React components — the pieces every generated page
 * repeats: the font `<link>`s, the GitHub mark, the header/theme-bar,
 * breadcrumb, footer, and the whole plain-static-page document shell.
 *
 * This is the React replacement for demo/site-shell.ts's `renderShell()` and
 * `pageHtml()` template literals (#589). Same DOM, same class names, same
 * copy — the point of the migration is a like-for-like rendering-engine swap,
 * not a redesign (#590 owns the redesign).
 *
 * Deliberately shaped as small, individually-exported components rather than
 * one monolith, so the shared component library #591 will build can adopt
 * them without first having to pull five one-off page implementations apart.
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { ReactNode } from 'react'
import { GOOGLE_FONTS_HREF } from './site-head.tsx'

/** The fork's own repository, linked from the header, footer, and hero. */
export const FORK_URL = 'https://github.com/dfadler/zombie-mermaid'

/**
 * Google Fonts preconnects plus the stylesheet every page loads
 * (Geist + JetBrains Mono).
 *
 * `crossOrigin=""` renders as the bare `crossorigin` attribute the
 * hand-written templates used; both parse to the same empty-string value.
 */
export function FontLinks() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={GOOGLE_FONTS_HREF} rel="stylesheet" />
    </>
  )
}

/** GitHub's Octocat mark, as an inline `<svg>` path (no external request). */
export function GitHubMarkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

/** The plain (no theme picker) site header: brand badge plus nav links. */
export function SiteHeader({ homeHref }: { homeHref: string }) {
  return (
    <div className="site-header">
      <a className="brand-badge" href={homeHref}>
        <strong>Zombie Mermaid</strong>
      </a>
      <nav className="header-links">
        <a href={homeHref}>Samples</a>
        <a href={`${homeHref}editor`}>Editor</a>
        <a href={`${homeHref}blog/`}>Blog</a>
        <a href={FORK_URL} target="_blank" rel="noopener">
          GitHub
        </a>
      </nav>
    </div>
  )
}

/** The theme-picker variant of the header, used when a page ships a picker. */
export function ThemeBar({
  homeHref,
  children,
}: {
  homeHref: string
  /** The theme pills (see demo/components/theme-picker.tsx). */
  children: ReactNode
}) {
  return (
    <div className="theme-bar" id="theme-bar">
      <a className="brand-badge shadow-minimal" href={homeHref}>
        <span>
          <strong>Zombie Mermaid</strong>
        </span>
      </a>
      <div className="theme-pills" id="theme-pills">
        {children}
      </div>
    </div>
  )
}

/** A `/`-separated crumb trail; `children` are the crumbs themselves. */
export function Breadcrumb({ children }: { children: ReactNode }) {
  return <div className="breadcrumb">{children}</div>
}

/** The separator between two breadcrumb crumbs. */
export function BreadcrumbSep() {
  return <span className="sep">/</span>
}

/** The shared footer for plain static pages (diagram pages, blog posts). */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>&copy; 2026 zombie-mermaid</span>
      <a href={FORK_URL} target="_blank" rel="noopener noreferrer">
        GitHub
      </a>
    </footer>
  )
}

export interface PageShellProps {
  /** Relative path back to the site root, e.g. `'../'`. */
  homeHref: string
  /** The crumb trail rendered above the page body. */
  breadcrumb: ReactNode
  /** The page's own content, between the breadcrumb and the footer. */
  children: ReactNode
  /**
   * Theme pills. When present the page gets the `.theme-bar` header instead
   * of the plain `.site-header` one — matching the old `renderShell()`,
   * where passing `themePillsHtml` selected the same variant.
   */
  themePills?: ReactNode
}

/** Header/theme-bar + breadcrumb + body + footer, the shared page chrome. */
export function PageShell({
  homeHref,
  breadcrumb,
  children,
  themePills,
}: PageShellProps) {
  return (
    <>
      {themePills === undefined ? (
        <SiteHeader homeHref={homeHref} />
      ) : (
        <ThemeBar homeHref={homeHref}>{themePills}</ThemeBar>
      )}
      <div className="content-wrapper">
        <Breadcrumb>{breadcrumb}</Breadcrumb>
        {children}
        <SiteFooter />
      </div>
    </>
  )
}

export interface StaticPageProps {
  title: string
  description: string
  canonical: string
  /** Href of the page's external stylesheet, relative to the page. */
  cssHref: string
  faviconHref: string
  /** Defaults to 'website'; pass 'article' for a single blog post. */
  ogType?: string
  /** ISO date; emitted as `article:published_time` when `ogType` is 'article'. */
  publishedTime?: string
  /** The `<body>`'s content. */
  children: ReactNode
  /** Scripts appended after the body content. */
  bodyScript?: ReactNode
}

/**
 * The complete `<html>` document for a plain static page — the React
 * replacement for demo/site-shell.ts's `pageHtml()`.
 *
 * Unlike `SiteHead` (which inlines a `<style>` block), these pages link an
 * external stylesheet the generator writes alongside them, and carry
 * canonical/Open Graph/Twitter metadata that the inline-styled pages don't.
 */
export function StaticPage({
  title,
  description,
  canonical,
  cssHref,
  faviconHref,
  ogType = 'website',
  publishedTime,
  children,
  bodyScript,
}: StaticPageProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content={ogType} />
        <meta property="og:url" content={canonical} />
        {ogType === 'article' && publishedTime ? (
          <meta property="article:published_time" content={publishedTime} />
        ) : null}
        <meta name="twitter:card" content="summary" />
        <link rel="icon" type="image/svg+xml" href={faviconHref} />
        <FontLinks />
        <link rel="stylesheet" href={cssHref} />
      </head>
      <body>
        {children}
        {bodyScript}
      </body>
    </html>
  )
}
