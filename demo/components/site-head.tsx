/** @jsxRuntime automatic */
/**
 * Shared `<head>` metadata for the site's generated pages: charset and
 * viewport, title and description, favicon, the Google Fonts preconnects
 * and stylesheet every page loads (Geist + JetBrains Mono), and the page's
 * own CSS inlined into a `<style>` element.
 *
 * Rendered as a fragment rather than a `<head>` element so a page can put
 * its own extras alongside it (index.ts's JSON-LD block, pages.ts's
 * canonical/Open Graph tags) once those pages are ported. First consumer:
 * dashboard.ts (the #423 pilot); fork-fixes.ts, editor.ts, and index.ts
 * each still carry a hand-written copy of this same block.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */

/** The Google Fonts stylesheet every page on the site loads. */
export const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap'

export interface SiteHeadProps {
  title: string
  /** Emitted as `<meta name="description">` when present. */
  description?: string
  /** CSS inlined into a `<style>` element after the font stylesheet link. */
  css: string
  /** Favicon href, relative to the page. Defaults to the site-root favicon. */
  faviconHref?: string
}

export function SiteHead({
  title,
  description,
  css,
  faviconHref = 'favicon.svg',
}: SiteHeadProps) {
  return (
    <>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title}</title>
      {description === undefined ? null : (
        <meta name="description" content={description} />
      )}
      <link rel="icon" href={faviconHref} type="image/svg+xml" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={GOOGLE_FONTS_HREF} rel="stylesheet" />
      <style>{css}</style>
    </>
  )
}
