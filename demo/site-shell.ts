/**
 * Shared static-page chrome: the header/theme-bar/breadcrumb/footer shell
 * and the surrounding `<html>` document, used by every generator that
 * produces plain (non-interactive-gallery) pages — currently `pages.ts`'s
 * per-diagram-type SEO pages and `blog.ts`'s posts. Extracted out of
 * `pages.ts` (where it originated) so both generators share one
 * implementation instead of drifting apart.
 */
import { escapeHtml } from './format.ts'

/** Renders the site header/theme-bar/breadcrumb/footer shell shared by every plain static page. */
export function renderShell(opts: {
  breadcrumb: string
  body: string
  homeHref: string
  themePillsHtml?: string
}): string {
  const themeBar = opts.themePillsHtml
    ? `
  <div class="theme-bar" id="theme-bar">
    <a class="brand-badge shadow-minimal" href="${opts.homeHref}"><span><strong>Zombie Mermaid</strong></span></a>
    <div class="theme-pills" id="theme-pills">
      ${opts.themePillsHtml}
    </div>
  </div>`
    : `
  <div class="site-header">
    <a class="brand-badge" href="${opts.homeHref}">
      <strong>Zombie Mermaid</strong>
    </a>
    <nav class="header-links">
      <a href="${opts.homeHref}">Samples</a>
      <a href="${opts.homeHref}editor">Editor</a>
      <a href="${opts.homeHref}blog/">Blog</a>
      <a href="https://github.com/dfadler/zombie-mermaid" target="_blank" rel="noopener">GitHub</a>
    </nav>
  </div>`

  return `${themeBar}
  <div class="content-wrapper">
  <div class="breadcrumb">${opts.breadcrumb}</div>
${opts.body}
  <footer class="site-footer">
    <span>&copy; 2026 zombie-mermaid</span>
    <a href="https://github.com/dfadler/zombie-mermaid" target="_blank" rel="noopener noreferrer">GitHub</a>
  </footer>
  </div>`
}

export function pageHtml(opts: {
  title: string
  description: string
  canonical: string
  cssHref: string
  faviconHref: string
  body: string
  bodyScript?: string
  /** Defaults to 'website'; pass 'article' for a single blog post. */
  ogType?: string
  /** ISO date; emitted as `article:published_time` when `ogType` is 'article'. */
  publishedTime?: string
}): string {
  const ogType = opts.ogType ?? 'website'
  const publishedTimeTag =
    ogType === 'article' && opts.publishedTime
      ? `\n  <meta property="article:published_time" content="${escapeHtml(opts.publishedTime)}" />`
      : ''
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
  <meta property="og:type" content="${ogType}" />
  <meta property="og:url" content="${opts.canonical}" />${publishedTimeTag}
  <meta name="twitter:card" content="summary" />
  <link rel="icon" type="image/svg+xml" href="${opts.faviconHref}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${opts.cssHref}" />
</head>
<body>
${opts.body}
${opts.bodyScript ?? ''}
</body>
</html>`
}
