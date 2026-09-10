/** @jsxRuntime automatic */
/**
 * `SiteHead` was an early, partial step toward one shared `<head>` shape
 * for the site's generated pages (charset/viewport/title/description/
 * favicon, plus the Google Fonts preconnects and stylesheet this file's own
 * `GOOGLE_FONTS_HREF` points at, and the page's CSS in a `<style>`
 * element). This doc comment used to claim dashboard.ts (the #423 pilot)
 * as its "first consumer" and name fork-fixes.ts/editor.ts/index.ts as
 * pages that "still carry a hand-written copy of this same block" — by the
 * time of zombie-mermaid#936, that had drifted: dashboard.ts never actually
 * rendered `<SiteHead>` (it hand-rolled the same shape independently, see
 * dashboard-page.tsx's own history), and editor-page.tsx was the *only*
 * real consumer.
 *
 * #936 replaced that one remaining use: `demo/components/document.tsx`'s
 * `Document` now owns the charset/viewport/title/description/favicon shell
 * for all six page generators (including editor.ts, which gets its own
 * Geist + JetBrains Mono font links from `site-chrome.tsx`'s `FontLinks`
 * instead of `SiteHead`'s bundled font+style combo — `Document` doesn't
 * hardcode one font family the way `SiteHead` did, since the other five
 * pages use a different pair, see tokens.tsx's `DesignFontLinks`). `SiteHead`
 * and `SiteHeadProps` below are therefore unused by any page generator as
 * of #936; kept rather than deleted since `GOOGLE_FONTS_HREF` (this file's
 * other export) is still very much in use (`site-chrome.tsx`'s `FontLinks`),
 * and `SiteHead` itself remains a correct, valid head-fragment shape a
 * future non-redesigned page could still reach for.
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
