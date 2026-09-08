/** @jsxRuntime automatic */
/**
 * The blog's post pages and index (blog.ts → blog/*.html) as React
 * components — part of #589's move of every site generator off
 * template-literal HTML.
 *
 * Pure functions of already-computed data: blog.ts still parses the
 * Markdown sources, renders them through marked + shiki, and formats
 * dates. Only the post body arrives here as raw HTML — marked's own output
 * for a file under version control, spliced into `.prose` (the element
 * that already carries the class, so no extra wrapper is introduced).
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import { BreadcrumbSep, PageShell, StaticPage } from './site-chrome.tsx'

/** The blog's own one-line description, reused as the index page's lede. */
export const BLOG_DESCRIPTION =
  "Updates on zombie-mermaid, and notes on what it's like maintaining it."

export interface BlogPostSummary {
  slug: string
  title: string
  /** Already formatted for display, e.g. "March 4, 2026". */
  displayDate: string
  description: string
}

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
}: BlogPostPageProps) {
  return (
    <StaticPage
      title={`${title} | Zombie Mermaid Blog`}
      description={description}
      canonical={canonical}
      cssHref={cssHref}
      faviconHref={faviconHref}
      ogType="article"
      publishedTime={publishedTime}
    >
      <PageShell
        homeHref="../"
        breadcrumb={
          <>
            <a href="../">Home</a>
            <BreadcrumbSep />
            <a href="./">Blog</a>
            <BreadcrumbSep />
            {title}
          </>
        }
      >
        <h1>{title}</h1>
        <p className="post-meta">{displayDate}</p>
        <div
          className="prose"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- marked output for a build-time Markdown file under version control (blog-posts/*.md), never user input
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />

        <div className="cta-row">
          <a className="cta-btn" href="./">
            More posts
          </a>
        </div>
      </PageShell>
    </StaticPage>
  )
}

export interface BlogIndexPageProps {
  canonical: string
  cssHref: string
  faviconHref: string
  posts: readonly BlogPostSummary[]
}

/** blog/index.html — the post list, newest first. */
export function BlogIndexPage({
  canonical,
  cssHref,
  faviconHref,
  posts,
}: BlogIndexPageProps) {
  return (
    <StaticPage
      title="Blog | Zombie Mermaid"
      description={BLOG_DESCRIPTION}
      canonical={canonical}
      cssHref={cssHref}
      faviconHref={faviconHref}
    >
      <PageShell
        homeHref="../"
        breadcrumb={
          <>
            <a href="../">Home</a>
            <BreadcrumbSep />
            Blog
          </>
        }
      >
        <h1>Blog</h1>
        <p className="lede">{BLOG_DESCRIPTION}</p>
        {posts.length === 0 ? (
          <p className="empty-state">No posts yet — check back soon.</p>
        ) : (
          <div className="post-list">
            {posts.map((post) => (
              <article className="post-card" key={post.slug}>
                <h2>
                  <a href={`${post.slug}.html`}>{post.title}</a>
                </h2>
                <p className="post-meta">{post.displayDate}</p>
                <p>{post.description}</p>
              </article>
            ))}
          </div>
        )}
      </PageShell>
    </StaticPage>
  )
}
