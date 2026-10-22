/**
 * Blog routes: one page per blog-posts/*.md, the index, feed.xml, blog.css.
 * Ported from the former packages/site/blog.ts, validation included.
 */
import { readdir, readFile } from 'node:fs/promises'
import { Marked, type Tokens } from 'marked'
import { createElement } from 'react'
import { createHighlighter, type Highlighter } from 'shiki'
import { parseFrontmatter } from '../frontmatter.ts'
import { escapeHtml } from '../../../demo/format.ts'
import { renderHtmlDocument } from '../../../demo/render-html.ts'
import {
  BLOG_DESCRIPTION,
  BlogIndexPage,
  BlogPostPage,
} from '../../../demo/components/blog-page.tsx'
import { sharedPageCss } from '../../../demo/components/shared-page-css.tsx'
import { DEFAULT_SWATCH } from '../../../demo/components/theme-picker.tsx'
import { renderMermaidSVG } from '../../../src/index.ts'
import { SITE_URL, type Clients, type Routes } from './shared.ts'

/** A fence with this language renders as highlighted source plus the SVG (blog-posts/README.md, "Code blocks"). */
const MERMAID_RENDER_LANG = 'mermaid-render'

/** github-dark: the redesign is a dark palette (see demo/blog.css `.prose pre`). */
const CODE_THEME = 'github-dark'

const POSTS_DIR = new URL('../../../blog-posts/', import.meta.url)

/** blog/index.html and blog/feed.xml already own these URLs. */
const RESERVED_SLUGS = new Set(['index', 'feed'])
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * `new Date("2026-02-30T...")` silently rolls over to March 2nd, so validate
 * the calendar date by round-tripping through UTC components.
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

    const slug = fields.slug ?? filename.slice(0, -'.md'.length)

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
 * Highlights a fenced block via shiki, loading the language on demand; a bad
 * or missing tag falls back to plain text rather than failing the build.
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lang is user-authored, validated at runtime via the catch below.
      await highlighter.loadLanguage(effective as any)
    } catch {
      effective = 'text'
    }
  }
  try {
    return highlighter.codeToHtml(code, { lang: effective, theme: CODE_THEME })
  } catch {
    return highlighter.codeToHtml(code, { lang: 'text', theme: CODE_THEME })
  }
}

/** A code token, extended with the highlighted HTML `walkTokens` computes. */
interface HighlightedCodeToken extends Tokens.Code {
  highlightedHtml?: string
}

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
  return `<div class="mermaid-render-block">${highlightedHtml}<div class="mermaid-diagram">${svg.replace('<svg', '<svg aria-label="Rendered Mermaid diagram"')}</div></div>\n`
}

async function renderPostBody(
  highlighter: Highlighter,
  bodyMarkdown: string,
  sourceFile: string,
): Promise<string> {
  // Marked never awaits an async renderer.code(); `async: true` makes it await
  // walkTokens instead, so shiki's async highlighting happens there and the
  // synchronous renderer.code() below just returns the resolved HTML.
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
        // Shiki ships a `mermaid` grammar but doesn't know the build-only tag.
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
      // Wrap wide GFM tables in demo/blog.css's `.table-scroll` container.
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

export async function blogRoutes(
  c: Clients,
  out: Routes,
  sitemap: string[],
): Promise<void> {
  // The redesign's shared CSS followed by demo/blog.css's page layout/prose.
  const blogCss = await readFile(
    new URL('../../../demo/blog.css', import.meta.url),
    'utf8',
  )
  out.set('blog/assets/blog.css', sharedPageCss(blogCss))

  const posts = await loadPosts()
  const highlighter = await createHighlighter({
    langs: [],
    themes: [CODE_THEME],
  })

  sitemap.push(`${SITE_URL}/blog/`)

  for (const post of posts) {
    const bodyHtml = await renderPostBody(
      highlighter,
      post.bodyMarkdown,
      post.sourceFile,
    )
    const canonical = `${SITE_URL}/blog/${post.slug}.html`
    sitemap.push(canonical)
    out.set(
      `blog/${post.slug}.html`,
      renderHtmlDocument(
        createElement(BlogPostPage, {
          title: post.title,
          displayDate: formatDisplayDate(post.date),
          description: post.description,
          canonical,
          cssHref: 'assets/blog.css',
          faviconHref: '../favicon.svg',
          publishedTime: post.date,
          bodyHtml,
          clientScript: c['blog-post-client']!,
        }),
      ),
    )
  }

  out.set(
    'blog/index.html',
    renderHtmlDocument(
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
        clientScript: c['blog-index-client']!,
      }),
    ),
  )

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
  out.set(
    'blog/feed.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Zombie Mermaid Blog</title>
    <link>${SITE_URL}/blog/</link>
    <description>${escapeHtml(BLOG_DESCRIPTION)}</description>
${feedItems}
  </channel>
</rss>
`,
  )
}
