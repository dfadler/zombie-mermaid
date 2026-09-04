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
 * Rendered via the same renderShell()/pageHtml() shell as pages.ts's
 * per-diagram-type pages (demo/site-shell.ts), so blog pages share the
 * rest of the site's header/breadcrumb/footer chrome.
 *
 * Post sources live in blog-posts/, a sibling of the generated blog/
 * output directory, not inside it — build:site's `mv blog site/blog`
 * moves the whole output directory verbatim, so a source subdirectory
 * nested inside it would ship the raw Markdown (and this file's own
 * README) onto the live site.
 *
 * Output: <repo root>/blog/<slug>.html (one per post), blog/index.html,
 * blog/feed.xml, blog/assets/blog.css, and appended entries in
 * sitemap.xml. build:site moves blog/ into site/, the same way it already
 * does for diagrams/.
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { Marked, type Tokens } from 'marked'
import { createHighlighter, type Highlighter } from 'shiki'
import { escapeHtml } from './demo/format.ts'
import { renderShell, pageHtml } from './demo/site-shell.ts'

/** The live site's base URL — matches pages.ts's SITE_URL (see that file's header comment). */
const SITE_URL = 'https://dfadler.github.io/zombie-mermaid'

const POSTS_DIR = new URL('./blog-posts/', import.meta.url)
const OUT_DIR = new URL('./blog/', import.meta.url)

/** blog/index.html and blog/feed.xml already own these URLs. */
const RESERVED_SLUGS = new Set(['index', 'feed'])

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

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
      theme: 'github-light',
    })
  } catch {
    return highlighter.codeToHtml(code, { lang: 'text', theme: 'github-light' })
  }
}

/** A code token, extended with the highlighted HTML `walkTokens` computes below. */
interface HighlightedCodeToken extends Tokens.Code {
  highlightedHtml?: string
}

async function renderPostBody(
  highlighter: Highlighter,
  bodyMarkdown: string,
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
      codeToken.highlightedHtml = await highlightCode(
        highlighter,
        codeToken.text,
        codeToken.lang,
      )
    },
    renderer: {
      code(token) {
        const highlightedHtml = (token as HighlightedCodeToken).highlightedHtml
        if (highlightedHtml === undefined) {
          throw new Error(
            'code token rendered before walkTokens highlighted it',
          )
        }
        return highlightedHtml
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

async function main(): Promise<void> {
  await mkdir(new URL('./assets/', OUT_DIR), { recursive: true })

  const [demoCss, blogCss] = await Promise.all([
    readFile(new URL('./demo/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('./demo/blog.css', import.meta.url), 'utf8'),
  ])
  await writeFile(
    new URL('./assets/blog.css', OUT_DIR),
    `${demoCss}\n${blogCss}`,
  )

  const posts = await loadPosts()
  const highlighter = await createHighlighter({
    langs: [],
    themes: ['github-light'],
  })

  const sitemapUrls: string[] = [`${SITE_URL}/blog/`]

  for (const post of posts) {
    const bodyHtml = await renderPostBody(highlighter, post.bodyMarkdown)
    const canonical = `${SITE_URL}/blog/${post.slug}.html`
    sitemapUrls.push(canonical)

    const body = renderShell({
      homeHref: '../',
      breadcrumb: `<a href="../">Home</a><span class="sep">/</span><a href="./">Blog</a><span class="sep">/</span>${escapeHtml(post.title)}`,
      body: `
  <h1>${escapeHtml(post.title)}</h1>
  <p class="post-meta">${formatDisplayDate(post.date)}</p>
  <div class="prose">
${bodyHtml}
  </div>

  <div class="cta-row">
    <a class="cta-btn" href="./">More posts</a>
  </div>
`,
    })

    const html = pageHtml({
      title: `${post.title} | Zombie Mermaid Blog`,
      description: post.description,
      canonical,
      cssHref: 'assets/blog.css',
      faviconHref: '../favicon.svg',
      body,
      ogType: 'article',
      publishedTime: post.date,
    })

    await writeFile(new URL(`./${post.slug}.html`, OUT_DIR), html)
  }

  // -- Index page --
  const listMarkup =
    posts.length === 0
      ? `<p class="empty-state">No posts yet — check back soon.</p>`
      : `<div class="post-list">
${posts
  .map(
    (post) => `    <article class="post-card">
      <h2><a href="${post.slug}.html">${escapeHtml(post.title)}</a></h2>
      <p class="post-meta">${formatDisplayDate(post.date)}</p>
      <p>${escapeHtml(post.description)}</p>
    </article>`,
  )
  .join('\n')}
  </div>`

  const indexBody = renderShell({
    homeHref: '../',
    breadcrumb: `<a href="../">Home</a><span class="sep">/</span>Blog`,
    body: `
  <h1>Blog</h1>
  <p class="lede">Updates on zombie-mermaid, and notes on what it's like maintaining it.</p>
  ${listMarkup}
`,
  })

  const indexHtml = pageHtml({
    title: 'Blog | Zombie Mermaid',
    description:
      "Updates on zombie-mermaid, and notes on what it's like maintaining it.",
    canonical: `${SITE_URL}/blog/`,
    cssHref: 'assets/blog.css',
    faviconHref: '../favicon.svg',
    body: indexBody,
  })

  await writeFile(new URL('./index.html', OUT_DIR), indexHtml)

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
    <description>${escapeHtml("Updates on zombie-mermaid, and notes on what it's like maintaining it.")}</description>
${feedItems}
  </channel>
</rss>
`
  await writeFile(new URL('./feed.xml', OUT_DIR), feedXml)

  // -- Append to the sitemap.xml pages.ts already wrote --
  const sitemapPath = new URL('./sitemap.xml', import.meta.url)
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
  await writeFile(sitemapPath, updatedSitemap)

  console.log(
    `Wrote ${posts.length} blog post(s) + index + feed.xml to ${OUT_DIR.pathname}, appended ${sitemapUrls.length} URLs to sitemap.xml`,
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exitCode = 1
})
