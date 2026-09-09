/** @jsxRuntime automatic */
/**
 * Shared site chrome — the pieces every generated page repeats: the font
 * `<link>`s, the GitHub mark, and the real nav-link destinations every
 * page's `NavIsland` (nav.tsx) call needs.
 *
 * This file used to also hold the header/theme-bar/breadcrumb/footer
 * components and the plain-static-page document shell (#589's React
 * replacement for demo/site-shell.ts). Those were superseded page-by-page —
 * `NavIsland` retired `SiteHeader`/`ThemeBar` (see nav.tsx's #598-610 note),
 * and each page grew its own `Footer`/`StaticPage`-equivalent — without ever
 * being deleted here, which is its own instance of the duplication problem
 * `HOME_HREF`/`ROOT_NAV_HREFS` below exist to fix (#832 review: the home
 * link broke twice because every page hand-rolled its own copy of this
 * data instead of importing one).
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import { GOOGLE_FONTS_HREF } from './site-head.tsx'
import type { NavKey } from './nav.tsx'

/** The fork's own repository, linked from the header, footer, and hero. */
export const FORK_URL = 'https://github.com/dfadler/zombie-mermaid'

/**
 * Absolute path back to the site root. Unlike a relative link, this
 * resolves correctly from every page regardless of nesting depth (root
 * pages, blog/*, diagrams/<type>/*) — see review feedback on #832. Every
 * page's `NavIsland` `homeHref` uses this one constant instead of each
 * page hand-rolling its own (which is exactly how the home/logo link broke,
 * twice, on two different pages).
 */
export const HOME_HREF = '/zombie-mermaid/'

/**
 * Nav link destinations for pages that live at the site root: index.html,
 * editor.html, fork-fixes.html, dashboard.html. A page whose own nav item
 * needs a different (self-referencing) value overrides just that one key
 * when spreading this in — see fork-fixes-page.tsx for an example.
 */
export const ROOT_NAV_HREFS: Record<NavKey, string> = {
  diagrams: 'diagrams/',
  editor: 'editor.html',
  forkFixes: 'fork-fixes.html',
  blog: 'blog/',
  github: FORK_URL,
}

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
