/**
 * Generates the blog: one page per post under blog-posts/*.md, an
 * index/hub page, an RSS feed, and sitemap.xml entries.
 *
 * Usage: tsx blog.ts
 *
 * Must run *after* pages.ts in build:site — it reads the sitemap.xml that
 * pages.ts already wrote and appends its own URLs, rather than each
 * generator owning a disjoint file. See CONTRIBUTING.md.
 *
 * Posts are plain Markdown with a small frontmatter block (title, date,
 * description, optional slug) — see blog-posts/README.md for the format.
 * Rendered through the site redesign's shared Nav/Footer and design
 * tokens (#607, part of #590/#591) — see demo/components/blog-page.tsx's
 * header comment for the layout itself.
 *
 * Post sources always live in blog-posts/ next to this file (resolved
 * from this file's own `import.meta.url`, never redirected by
 * `SITE_OUT_DIR` — see scripts/site-out-dir.ts), a sibling of the
 * generated blog/ *output* directory, not inside it — so a source
 * subdirectory nested inside the output tree never ships the raw Markdown
 * (and this file's own README) onto the live site.
 *
 * Output: <output dir>/blog/<slug>.html (one per post), blog/index.html,
 * blog/feed.xml, blog/assets/blog.css, and appended entries in
 * sitemap.xml — resolved relative to the repo root by default, or to
 * `SITE_OUT_DIR` when set. build:site sets `SITE_OUT_DIR=site` so this
 * writes directly into site/blog/, the same way pages.ts writes directly
 * into site/diagrams/.
 */

import { readdir, readFile, rm } from 'node:fs/promises'
import { Marked, type Tokens } from 'marked'
import { createElement } from 'react'
import { createHighlighter, type Highlighter } from 'shiki'
import { escapeHtml } from '../demo/format.ts'
import { renderHtmlDocument } from '../demo/render-html.ts'
import {
  BLOG_DESCRIPTION,
  BlogIndexPage,
  BlogPostPage,
} from '../demo/components/blog-page.tsx'
import { sharedPageCss } from '../demo/components/shared-page-css.tsx'
import { DEFAULT_SWATCH } from '../demo/components/theme-picker.tsx'
import { renderMermaidSVG } from '../src/index.ts'
import { bundleForBrowser } from '../scripts/vite-bundle.ts'
import { siteOutDir } from '../scripts/site-out-dir.ts'
import { generatePage } from '../scripts/generate-page.ts'

/**
 * A fenced code block tagged with this language renders as its
 * syntax-highlighted source followed by an actual SVG diagram (via the same
 * renderMermaidSVG pages.ts uses for the per-type gallery), back to back.
 * Plain ` ```mermaid ` fences deliberately keep rendering as source text
 * only, with no diagram — see blog-posts/README.md's "Code blocks" section
 * for why the two aren't interchangeable (mainly: several posts' mermaid
 * fences are the exact source used to produce an adjacent before/after
 * screenshot, or a repro of an *upstream* bug that this fork's own renderer
 * no longer has, so auto-rendering them would show fixed/different output
 * instead of the thing being illustrated).
 */
const MERMAID_RENDER_LANG = 'mermaid-render'

/**
 * The shiki theme fenced code blocks highlight with.
 *
 * 'github-dark' rather than the pre-redesign 'github-light': the redesign
 * (#590) is a dark palette (tokens.tsx's `--bg` is `#0a0d16`), and a
 * light-background code block would clash badly rather than read as an
 * intentional "printed page" accent. github-dark's own background
 * (`#0d1117`) sits close enough to `--bg` that demo/blog.css's `.prose
 * pre` border/radius wrap it without a visible seam.
 */
const CODE_THEME = 'github-dark'

/** The live site's base URL — matches pages.ts's SITE_URL (see that file's header comment). */
const SITE_URL = 'https://dfadler.github.io/zombie-mermaid'

const POSTS_DIR = new URL('../blog-posts/', import.meta.url)
const OUT_DIR = new URL('./blog/', siteOutDir())

/** blog/index.html and blog/feed.xml already own these URLs. */
const RESERVED_SLUGS = new Set(['index', 'feed'])

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * `new Date("2026-02-30T...")` doesn't throw — it silently rolls over to
 * March 2nd. A frontmatter typo like that would otherwise ship a wrong
 * date instead of a build error, so validate the calendar date by
 * round-tripping it through UTC components rather than trusting `Date` to
 * reject an out-of-range day/month on its own.
 */
function isValidCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value)
  if (!match) return false
  const [, yearStr, monthStr, dayStr] = match
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

interface Post {
  slug: string
  title: string
  date: string
  description: string
  bodyMarkdown: string
  sourceFile: string
}

/**
 * Splits a post file into its frontmatter block and Markdown body.
 *
 * Deliberately not a full YAML parser: frontmatter here is a flat list of
 * `key: value` lines, which is all title/date/description/slug need. A
 * real YAML dependency would be overkill for four scalar fields.
 */
function parseFrontmatter(
  raw: string,
  sourceFile: string,
): { fields: Record<string, string>; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw)
  if (!match) {
    throw new Error(
      `${sourceFile}: missing frontmatter block (expected a leading "---" ... "---" section)`,
    )
  }
  const [, frontmatter, body] = match
  const fields: Record<string, string> = {}
  for (const line of frontmatter!.split('\n')) {
    if (!line.trim()) continue
    const separatorIndex = line.indexOf(':')
    if (separatorIndex === -1) {
      throw new Error(`${sourceFile}: malformed frontmatter line: "${line}"`)
    }
    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()
    fields[key] = value
  }
  return { fields, body: body!.trim() }
}

async function loadPosts(): Promise<Post[]> {
  let filenames: string[]
  try {
    // README.md documents the format for post authors — it isn't a post.
    filenames = (await readdir(POSTS_DIR)).filter(
      (f) => f.endsWith('.md') && f !== 'README.md',
    )
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }

  const posts: Post[] = []
  const seenSlugs = new Map<string, string>()

  for (const filename of filenames) {
    const sourceFile = `blog-posts/${filename}`
    const raw = await readFile(new URL(filename, POSTS_DIR), 'utf8')
    const { fields, body } = parseFrontmatter(raw, sourceFile)

    for (const required of ['title', 'date', 'description']) {
      if (!fields[required]) {
        throw new Error(
          `${sourceFile}: missing required frontmatter field "${required}"`,
        )
      }
    }
    if (!isValidCalendarDate(fields.date!)) {
      throw new Error(
        `${sourceFile}: date "${fields.date}" must be a real calendar date in YYYY-MM-DD format`,
      )
    }

    const filenameStem = filename.slice(0, -'.md'.length)
    const slug = fields.slug ?? filenameStem

    if (!SLUG_PATTERN.test(slug)) {
      throw new Error(
        `${sourceFile}: slug "${slug}" must be lowercase kebab-case (letters, digits, hyphens only)`,
      )
    }
    if (RESERVED_SLUGS.has(slug)) {
      throw new Error(
        `${sourceFile}: slug "${slug}" is reserved (blog/${slug} already exists)`,
      )
    }
    const existing = seenSlugs.get(slug)
    if (existing) {
      throw new Error(`Slug collision "${slug}": ${existing} and ${sourceFile}`)
    }
    seenSlugs.set(slug, sourceFile)

    posts.push({
      slug,
      title: fields.title!,
      date: fields.date!,
      description: fields.description!,
      bodyMarkdown: body,
      sourceFile,
    })
  }

  // Newest first, both on the index page and in the RSS feed.
  posts.sort((a, b) => b.date.localeCompare(a.date))
  return posts
}

/**
 * Highlights a fenced code block via shiki, loading the requested
 * language on demand. Post authors write whatever language tag they like
 * in a fence (or none) — that string isn't statically known at compile
 * time, so a bad or missing tag is validated at runtime here and falls
 * back to plain text rather than failing the whole build.
 */
async function highlightCode(
  highlighter: Highlighter,
  code: string,
  lang: string | undefined,
): Promise<string> {
  const requested = (lang ?? '').trim().toLowerCase() || 'text'
  let effective = requested
  if (
    effective !== 'text' &&
    !highlighter.getLoadedLanguages().includes(effective)
  ) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see doc comment: lang is user-authored, validated at runtime via the catch below.
      await highlighter.loadLanguage(effective as any)
    } catch {
      effective = 'text'
    }
  }
  try {
    return highlighter.codeToHtml(code, {
      lang: effective,
      theme: CODE_THEME,
    })
  } catch {
    return highlighter.codeToHtml(code, { lang: 'text', theme: CODE_THEME })
  }
}

/** A code token, extended with the highlighted HTML `walkTokens` computes below. */
interface HighlightedCodeToken extends Tokens.Code {
  highlightedHtml?: string
}

/**
 * Renders a `mermaid-render`-tagged fence to its syntax-highlighted source
 * followed by the rendered SVG diagram, back to back — the diagram via the
 * same options (colors) shape the per-diagram-type gallery pages already
 * render with (pages.ts), see the DEFAULT_SWATCH import above. Showing the
 * source alongside the render (rather than the render alone) means a reader
 * doesn't need to go find the Mermaid source elsewhere to see what produced
 * it; unlike a plain ` ```mermaid ` fence, this fence's whole point is that
 * the diagram should render, so there's no "don't auto-render me" case to
 * preserve here — see blog-posts/README.md's "Code blocks" section.
 */
function renderMermaidDiagram(
  source: string,
  highlightedHtml: string,
  sourceFile: string,
): string {
  let svg: string
  try {
    svg = renderMermaidSVG(source.trim(), {
      ...DEFAULT_SWATCH,
      interactivity: 'none',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(
      `${sourceFile}: a \`\`\`${MERMAID_RENDER_LANG} fence failed to render: ${message}`,
    )
  }
  return `<div class="mermaid-render-block">${highlightedHtml}<div class="mermaid-diagram">${svg}</div></div>\n`
}

async function renderPostBody(
  highlighter: Highlighter,
  bodyMarkdown: string,
  sourceFile: string,
): Promise<string> {
  // marked's renderer methods are always called synchronously — an async
  // (Promise-returning) renderer.code() is *not* awaited, it's just
  // string-concatenated as "[object Promise]". `async: true` instead makes
  // marked await `walkTokens`, so shiki's async highlighting has to happen
  // there: walkTokens mutates each code token in place with the already-
  // resolved HTML, and the synchronous renderer.code() below just returns it.
  const marked = new Marked({
    async: true,
    walkTokens: async (token) => {
      if (token.type !== 'code') return
      const codeToken = token as HighlightedCodeToken
      const isMermaidRender =
        codeToken.lang?.trim().toLowerCase() === MERMAID_RENDER_LANG
      codeToken.highlightedHtml = await highlightCode(
        highlighter,
        codeToken.text,
        // Highlight a mermaid-render fence's source as plain `mermaid`
        // syntax (shiki ships a grammar for it) rather than under its own
        // build-only tag, which shiki wouldn't recognize as a language.
        isMermaidRender ? 'mermaid' : codeToken.lang,
      )
    },
    renderer: {
      code(token) {
        const codeToken = token as HighlightedCodeToken
        const highlightedHtml = codeToken.highlightedHtml
        if (highlightedHtml === undefined) {
          throw new Error(
            'code token rendered before walkTokens highlighted it',
          )
        }
        if (codeToken.lang?.trim().toLowerCase() === MERMAID_RENDER_LANG) {
          return renderMermaidDiagram(
            codeToken.text,
            highlightedHtml,
            sourceFile,
          )
        }
        return highlightedHtml
      },
      // marked emits a bare <table> with no wrapper, so a wide GFM table
      // (see blog-posts/for-mermaid-ascii-users.md's comparison tables)
      // would force the whole page to scroll horizontally. Rebuild the
      // default table markup (via the inherited tablerow/tablecell) and
      // wrap it in a scroll container that demo/blog.css's .table-scroll
      // rule targets, rather than reaching for `display: block` on
      // <table> itself, which breaks column-width layout.
      table(token) {
        let headerHtml = ''
        for (const cell of token.header) {
          headerHtml += this.tablecell(cell)
        }
        const headerRow = this.tablerow({ text: headerHtml })

        let bodyHtml = ''
        for (const row of token.rows) {
          let rowHtml = ''
          for (const cell of row) {
            rowHtml += this.tablecell(cell)
          }
          bodyHtml += this.tablerow({ text: rowHtml })
        }
        if (bodyHtml) bodyHtml = `<tbody>${bodyHtml}</tbody>`

        return `<div class="table-scroll"><table>\n<thead>\n${headerRow}</thead>\n${bodyHtml}</table>\n</div>\n`
      },
    },
  })
  return await marked.parse(bodyMarkdown, { async: true })
}

function formatDisplayDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function rfc822Date(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toUTCString()
}

/**
 * Bundle `demo/blog-post-client.tsx` (zombie-mermaid#803's post-page
 * hydration entry) for the browser — mirrors dashboard.ts's
 * `bundleDashboardClient()` (inlined directly, `minify: true` since this
 * is the first bundle on the post template to include `react`/`react-dom`
 * — see that function's doc comment for the measured minified-vs-
 * unminified difference, which applies unchanged here). Built once and
 * reused verbatim across every post page, the same way
 * `bundleNavClient()`'s output used to be.
 */
async function bundleBlogPostClient(): Promise<string> {
  return bundleForBrowser(
    new URL('../demo/blog-post-client.tsx', import.meta.url).pathname,
    { minify: true },
  )
}

/** Bundle `demo/blog-index-client.tsx` (zombie-mermaid#803's index-page
 * hydration entry) for the browser — see {@link bundleBlogPostClient}'s
 * doc comment for the identical reasoning. */
async function bundleBlogIndexClient(): Promise<string> {
  return bundleForBrowser(
    new URL('../demo/blog-index-client.tsx', import.meta.url).pathname,
    { minify: true },
  )
}

async function main(): Promise<void> {
  // A renamed or deleted post must actually disappear from the built site,
  // not linger from a previous run — clear the whole output directory
  // before regenerating it. Safe to remove wholesale: OUT_DIR only ever
  // holds generated output, never blog-posts/ (a sibling, not a child).
  await rm(OUT_DIR, { recursive: true, force: true })

  // The redesign's shared CSS (#590/#591) — palette/base elements, the
  // .card/.pill/.section-eyebrow primitives, and the Nav/Footer responsive
  // rules — followed by demo/blog.css's own page-specific layout and
  // .prose typography. Unlike the pre-redesign version, this no longer
  // concatenates demo/styles.css: that file's --t-*-themed classes
  // (.site-header, .post-card, .cta-btn, …) belonged to site-chrome.tsx's
  // chrome, which blog-page.tsx no longer renders now that it uses the
  // shared Nav/Footer instead.
  const blogCss = await readFile(
    new URL('../demo/blog.css', import.meta.url),
    'utf8',
  )
  await generatePage({
    outPath: new URL('./assets/blog.css', OUT_DIR),
    content: sharedPageCss(blogCss),
    log: false,
  })

  // #803: postClientScript/indexClientScript hydrate BlogPostApp/
  // BlogIndexApp + NavIsland (one bundle each, reused across every
  // post/the index respectively).
  const [postClientScript, indexClientScript] = await Promise.all([
    bundleBlogPostClient(),
    bundleBlogIndexClient(),
  ])

  const posts = await loadPosts()
  const highlighter = await createHighlighter({
    langs: [],
    themes: [CODE_THEME],
  })

  const sitemapUrls: string[] = [`${SITE_URL}/blog/`]

  for (const post of posts) {
    const bodyHtml = await renderPostBody(
      highlighter,
      post.bodyMarkdown,
      post.sourceFile,
    )
    const canonical = `${SITE_URL}/blog/${post.slug}.html`
    sitemapUrls.push(canonical)

    const html = renderHtmlDocument(
      createElement(BlogPostPage, {
        title: post.title,
        displayDate: formatDisplayDate(post.date),
        description: post.description,
        canonical,
        cssHref: 'assets/blog.css',
        faviconHref: '../favicon.svg',
        publishedTime: post.date,
        bodyHtml,
        clientScript: postClientScript,
      }),
    )

    await generatePage({
      outPath: new URL(`./${post.slug}.html`, OUT_DIR),
      content: html,
      log: false,
    })
  }

  // -- Index page --
  const indexHtml = renderHtmlDocument(
    createElement(BlogIndexPage, {
      canonical: `${SITE_URL}/blog/`,
      cssHref: 'assets/blog.css',
      faviconHref: '../favicon.svg',
      posts: posts.map((post) => ({
        slug: post.slug,
        title: post.title,
        displayDate: formatDisplayDate(post.date),
        description: post.description,
      })),
      clientScript: indexClientScript,
    }),
  )

  await generatePage({
    outPath: new URL('./index.html', OUT_DIR),
    content: indexHtml,
    log: false,
  })

  // -- RSS feed --
  const feedItems = posts
    .map(
      (post) => `    <item>
      <title>${escapeHtml(post.title)}</title>
      <link>${SITE_URL}/blog/${post.slug}.html</link>
      <guid>${SITE_URL}/blog/${post.slug}.html</guid>
      <description>${escapeHtml(post.description)}</description>
      <pubDate>${rfc822Date(post.date)}</pubDate>
    </item>`,
    )
    .join('\n')

  const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Zombie Mermaid Blog</title>
    <link>${SITE_URL}/blog/</link>
    <description>${escapeHtml(BLOG_DESCRIPTION)}</description>
${feedItems}
  </channel>
</rss>
`
  await generatePage({
    outPath: new URL('./feed.xml', OUT_DIR),
    content: feedXml,
    log: false,
  })

  // -- Append to the sitemap.xml pages.ts already wrote --
  const sitemapPath = new URL('./sitemap.xml', siteOutDir())
  const existingSitemap = await readFile(sitemapPath, 'utf8')
  const newUrlLines = sitemapUrls
    .map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`)
    .join('\n')
  if (!existingSitemap.includes('</urlset>')) {
    throw new Error(
      'sitemap.xml is missing </urlset> — expected pages.ts to have run first and written a well-formed sitemap',
    )
  }
  const updatedSitemap = existingSitemap.replace(
    '</urlset>',
    `${newUrlLines}\n</urlset>`,
  )
  await generatePage({
    outPath: sitemapPath,
    content: updatedSitemap,
    log: false,
  })

  console.log(
    `Wrote ${posts.length} blog post(s) + index + feed.xml to ${OUT_DIR.pathname}, appended ${sitemapUrls.length} URLs to sitemap.xml`,
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exitCode = 1
})
