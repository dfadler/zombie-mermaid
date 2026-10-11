/** @jsxRuntime automatic */
/**
 * The one shared `<html><head>...</head><body>{children}</body></html>`
 * shell every site-generator page renders into (zombie-mermaid#936, part of
 * the #931 umbrella).
 *
 * Before this file, each of the six `*-page.tsx` files (`index-page.tsx`,
 * `editor-page.tsx`, `dashboard-page.tsx`, `fork-fixes-page.tsx`,
 * `diagram-page.tsx`'s `DiagramTypePage`/`DiagramHubPage`, `blog-page.tsx`'s
 * `BlogPostPage`/`BlogIndexPage`) independently authored its own complete
 * `<html>` tree — `demo/render-html.ts` only wraps an *already-complete*
 * `<html>` element with the `<!DOCTYPE html>` string prefix, so it never
 * provided any shell structure of its own. `site-head.tsx`'s `<SiteHead>`
 * got partway there (charset/viewport/title/description/favicon, plus its
 * own font links and a `<style>`) but only one page (`editor-page.tsx`) ever
 * actually rendered it — see that file's own corrected doc comment.
 *
 * `Document` owns exactly the boilerplate every page's `<head>` opened with,
 * byte-for-byte identically: charset, viewport, `<title>`, an optional
 * `<meta name="description">`, and the primary favicon `<link>`. Everything
 * else a page's `<head>` needs — canonical/Open Graph/Twitter tags, JSON-LD,
 * extra favicon fallbacks, font links, page stylesheets — stays exactly
 * what it was, just passed through the `head` prop instead of being
 * authored inline in a hand-rolled `<head>` element. This is deliberately a
 * thin shell rather than a bigger abstraction over `<head>` content: the six
 * pages' SEO/meta tag sets are still genuinely different pages (some have
 * Open Graph tags, some don't; some have a second favicon fallback, some
 * don't), and forcing them into one shape would be a product change dressed
 * up as a refactor. See docs/decisions/ (or this issue's own PR body) for
 * the one deliberate side effect of centralizing the favicon `<link>` here:
 * on the three pages that used to render it *after* their canonical/OG/
 * Twitter tags (`index-page.tsx`, `diagram-page.tsx`, `blog-page.tsx`), it
 * now renders right after the description meta tag instead, matching the
 * other three pages (and `site-head.tsx`'s own original shape) — a
 * `<head>`-internal reordering with no rendering or SEO effect, not a
 * behavior change.
 *
 * `bodyStyle` exists only because `blog-page.tsx`'s `BlogDocument` set one
 * inline style on `<body>` (`background: colorVar('--bg')`) — every other
 * page's `<body>` is bare.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { CSSProperties, ReactNode } from 'react'

export interface DocumentProps {
  /** `<html lang>`. Every page passes `"en"` today (the default); kept
   * overridable rather than hardcoded so a future non-English page doesn't
   * need to bypass `Document` entirely for one attribute. */
  lang?: string
  /** `<title>` text. */
  title: string
  /** Emitted as `<meta name="description">` when present. Omitted
   * entirely (no tag at all) when `undefined` — `editor-page.tsx` relies on
   * this: editor.html has never had a meta description. */
  description?: string
  /** The primary favicon `<link>`'s `href`, always `type="image/svg+xml"`.
   * Defaults to `'favicon.svg'`, matching every page's own previous
   * default/literal. A page needing an *additional* favicon fallback (a
   * `.ico` for old browsers, an `apple-touch-icon`) still adds those itself
   * via `head` — this prop only ever covers the one primary link every page
   * already had. */
  faviconHref?: string
  /** Everything else the page's `<head>` needs, rendered immediately after
   * the shared boilerplate above: canonical/Open Graph/Twitter tags,
   * JSON-LD, extra favicon links, font links, and the page's own
   * stylesheet(s). */
  head?: ReactNode
  /** Inline style for `<body>` itself. Only `blog-page.tsx` uses this
   * today; every other page's `<body>` is bare (`undefined` here omits the
   * `style` attribute entirely, same as not writing one). */
  bodyStyle?: CSSProperties
  /** The page's body content. */
  children: ReactNode
}

/** The shared document shell every site-generator page renders into. */
export function Document({
  lang = 'en',
  title,
  description,
  faviconHref = 'favicon.svg',
  head,
  bodyStyle,
  children,
}: DocumentProps) {
  return (
    <html lang={lang}>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        {description === undefined ? null : (
          <meta name="description" content={description} />
        )}
        <link rel="icon" href={faviconHref} type="image/svg+xml" />
        {head}
      </head>
      <body style={bodyStyle}>{children}</body>
    </html>
  )
}
