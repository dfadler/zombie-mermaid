/** @jsxRuntime automatic */
/**
 * The blog's *hydrated* content (zombie-mermaid#803): {@link BlogPostApp}
 * (a post's breadcrumb, title, date, and Markdown-rendered body) and
 * {@link BlogIndexApp} (the index's breadcrumb, hero, and featured-post +
 * archive grid, or its empty state). Split out of `blog-page.tsx` (which
 * used to be a full-document owner, like `dashboard-page.tsx` was
 * pre-#799) specifically so this file, and everything it imports, never
 * touches `react-dom/server` — mirroring `dashboard-app.tsx`'s split. Two
 * hydrated apps live in one file (rather than `blog-post-app.tsx` +
 * `blog-index-app.tsx`) because they share `BlogBreadcrumb`/`ArrowLink`
 * and both stay small; `demo/blog-post-client.tsx`/`demo/blog-index-
 * client.tsx` each import only the one they hydrate.
 *
 * `<NavIsland>`, `<ThemePickerSection>` (index only — a single post has no
 * theme picker; see `blog-page.tsx`'s `BlogPostPageProps` for why it never
 * took a `themeBarScript` either), and `<Footer>` are deliberately **not**
 * rendered here — they stay in `blog-page.tsx` as plain siblings of each
 * app's hydration container, the same way `dashboard-page.tsx` and
 * `fork-fixes-page.tsx` render them: nesting `ThemePickerSection` inside a
 * hydrated component tree drags `react-dom/server` into the client bundle
 * (via `ThemePickerIsland`) and double-hydrates `#theme-pills` — see
 * `dashboard-app.tsx`'s header comment for the full story this repeats.
 *
 * The post body (`bodyHtml`) is marked's own Markdown-to-HTML output for a
 * build-time file under version control — already a plain string by the
 * time it reaches here, so it round-trips through the serialized
 * hydration props with no `marked`/shiki re-render in the browser. Same
 * for every other field on both apps' props: plain strings/numbers, no
 * `ReactNode`.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { CSSProperties, ReactNode } from 'react'
import { Fragment } from 'react'
import { ArrowRightIcon, LogoMark, ChevronRightIcon } from './icons.tsx'
import { CTA, Card, Pill, SectionEyebrow } from './primitives.tsx'
import {
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  LETTER_SPACING,
  SECTION_SPACE,
  SPACE,
  colorVar,
} from './tokens.tsx'

/** The blog's own one-line description, reused as the index page's lede
 * and (via `blog-page.tsx`'s re-export) `BlogDocument`'s meta description
 * for the index page. */
export const BLOG_DESCRIPTION =
  "Updates on zombie-mermaid, and notes on what it's like maintaining it."

/* -----------------------------------------------------------------
 * Breadcrumb
 * ----------------------------------------------------------------- */

interface Crumb {
  label: string
  /** Omit for the current page's own crumb, which renders as plain text. */
  href?: string
}

/** The `mono`, faint-separated crumb trail every blog page opens with. */
function BlogBreadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <div
      className="mono"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: `${SPACE.sm}px`,
        fontSize: `${FONT_SIZE.bodySm}px`,
        fontWeight: FONT_WEIGHT.semibold,
        color: colorVar('--text-faint'),
      }}
    >
      {crumbs.map((crumb, index) => (
        <Fragment key={crumb.label}>
          {index > 0 ? <ChevronRightIcon size={12} strokeWidth={2.4} /> : null}
          {crumb.href === undefined ? (
            <span aria-current="page" style={{ color: colorVar('--text-dim') }}>
              {crumb.label}
            </span>
          ) : (
            <a href={crumb.href}>{crumb.label}</a>
          )}
        </Fragment>
      ))}
    </div>
  )
}

/* -----------------------------------------------------------------
 * Arrow link — "Read the post" / "Read more" / a post's own byline link
 * ----------------------------------------------------------------- */

function ArrowLink({
  href,
  fontSize = FONT_SIZE.bodyLg,
  iconSize = 14,
  style,
  children,
}: {
  href: string
  fontSize?: number
  iconSize?: number
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <a
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: `${fontSize}px`,
        fontWeight: FONT_WEIGHT.bold,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
      <ArrowRightIcon size={iconSize} />
    </a>
  )
}

/* -----------------------------------------------------------------
 * Post page — hydrated content
 * ----------------------------------------------------------------- */

/**
 * `blog-post-root`: id of the *hydration container*
 * `demo/blog-post-client.tsx`'s `hydrateRoot()` call mounts onto — a plain
 * wrapper `<div>` `blog-page.tsx`'s `BlogPostPage` renders directly, not
 * part of {@link BlogPostApp}'s own render output. See `dashboard-
 * app.tsx`'s `DASHBOARD_ROOT_ID` doc comment for why this has to be a
 * separate element from `BlogPostApp`'s own root.
 */
export const BLOG_POST_ROOT_ID = 'blog-post-root'

/**
 * `blog-post-props`: the `<script type="application/json">` element
 * `demo/blog-post-client.tsx` reads {@link BlogPostAppProps} out of.
 */
export const BLOG_POST_PROPS_ELEMENT_ID = 'blog-post-props'

export interface BlogPostAppProps {
  title: string
  /** Already formatted for display, e.g. "March 4, 2026". */
  displayDate: string
  /** The post body, rendered from Markdown by marked + shiki. */
  bodyHtml: string
}

/**
 * One blog post's hydrated content: breadcrumb, title, date pill, body,
 * and the "More posts" CTA. The exact same function runs on both sides of
 * hydration — see `dashboard-app.tsx`'s {@link DashboardApp} doc comment
 * for the general shape this follows.
 *
 * #607's issue explicitly notes the design canvas has no mockup for a post
 * page — only the index; see `blog-page.tsx`'s original `BlogPostPage` doc
 * comment (still applies) for the layout reasoning this inherited as-is.
 */
export function BlogPostApp({
  title,
  displayDate,
  bodyHtml,
}: BlogPostAppProps) {
  return (
    <>
      <div
        className="section-px"
        style={{
          padding: `${SECTION_SPACE.default}px ${LAYOUT.gutter.desktop}px 0 ${LAYOUT.gutter.desktop}px`,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            maxWidth: `${LAYOUT.proseMaxWidth}px`,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: `${SPACE.xl}px`,
          }}
        >
          <BlogBreadcrumb
            crumbs={[
              { label: 'Home', href: '../' },
              { label: 'Blog', href: './' },
              { label: title },
            ]}
          />
          <h1
            style={{
              fontSize: `${FONT_SIZE.h1}px`,
              lineHeight: 1.15,
              letterSpacing: LETTER_SPACING.heading,
            }}
          >
            {title}
          </h1>
          <Pill
            mono
            style={{
              alignSelf: 'flex-start',
              background: colorVar('--panel-2'),
              color: colorVar('--text-faint'),
              fontSize: `${FONT_SIZE.label}px`,
              padding: '8px 16px',
            }}
          >
            {displayDate}
          </Pill>
        </div>
      </div>

      <div
        className="section-px"
        style={{
          padding: `${SPACE['6xl']}px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.hero}px ${LAYOUT.gutter.desktop}px`,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{ maxWidth: `${LAYOUT.proseMaxWidth}px`, margin: '0 auto' }}
        >
          <div
            className="prose"
            // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- marked output for a build-time Markdown file under version control (blog-posts/*.md), never user input
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />

          <div
            style={{
              marginTop: `${SPACE['7xl']}px`,
              paddingTop: `${SPACE['5xl']}px`,
              borderTop: `1px solid ${colorVar('--border')}`,
            }}
          >
            <CTA href="./" accent="violet">
              More posts
            </CTA>
          </div>
        </div>
      </div>
    </>
  )
}

/* -----------------------------------------------------------------
 * Index page — hydrated content
 * ----------------------------------------------------------------- */

export interface BlogPostSummary {
  slug: string
  title: string
  /** Already formatted for display, e.g. "March 4, 2026". */
  displayDate: string
  description: string
}

/**
 * `blog-index-root`: id of the *hydration container*
 * `demo/blog-index-client.tsx`'s `hydrateRoot()` call mounts onto — see
 * {@link BLOG_POST_ROOT_ID}'s doc comment for the same reasoning.
 */
export const BLOG_INDEX_ROOT_ID = 'blog-index-root'

/**
 * `blog-index-props`: the `<script type="application/json">` element
 * `demo/blog-index-client.tsx` reads {@link BlogIndexAppProps} out of.
 */
export const BLOG_INDEX_PROPS_ELEMENT_ID = 'blog-index-props'

/**
 * A generic, brand-consistent stand-in for the mockup's bespoke
 * mermaid-ascii-comparison graphic — see `blog-page.tsx`'s original header
 * comment for why the real one doesn't generalise across posts. Reuses the
 * shared `LogoMark` inside a `glow`-tone {@link Card}, with the same gentle
 * float the mockup's own visual uses (`.float-anim`, defined in
 * demo/blog.css, with a `prefers-reduced-motion` guard).
 */
function FeaturedVisual() {
  return (
    <div
      className="featured-visual float-anim"
      style={{ flex: '0 0 220px', maxWidth: '100%' }}
    >
      <Card
        tone="glow"
        accent="cyan"
        style={{
          width: '220px',
          height: '220px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LogoMark size={96} />
      </Card>
    </div>
  )
}

/** The most recent post, given the showcase treatment: a large bordered
 * card with its own eyebrow, above the archive grid. */
function FeaturedPost({ post }: { post: BlogPostSummary }) {
  return (
    <div
      className="section-px"
      style={{
        padding: `0 ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.snug + 24}px ${LAYOUT.gutter.desktop}px`,
        position: 'relative',
        zIndex: 1,
      }}
    >
      <div style={{ maxWidth: `${LAYOUT.maxWidth}px`, margin: '0 auto' }}>
        <SectionEyebrow style={{ marginBottom: `${SPACE.xl}px` }}>
          Latest post
        </SectionEyebrow>

        <Card
          accent="cyan"
          className="featured-card"
          padding={48}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: `${SPACE['6xl']}px`,
          }}
        >
          <div
            style={{
              flex: '1 1 auto',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: `${SPACE['2xl']}px`,
            }}
          >
            <Pill
              mono
              style={{
                alignSelf: 'flex-start',
                background: colorVar('--panel-2'),
                color: colorVar('--text-faint'),
                fontSize: `${FONT_SIZE.label}px`,
                padding: '8px 16px',
              }}
            >
              {post.displayDate}
            </Pill>
            <h2
              style={{
                fontSize: `${FONT_SIZE.h2}px`,
                lineHeight: 1.2,
                letterSpacing: LETTER_SPACING.heading,
              }}
            >
              {/* `color: inherit`: the mockup's h2 is bare text with a separate
                  arrow-link for navigation, but a real title should itself be
                  clickable for a larger hit target — see blog-page.tsx's
                  original header comment. Inheriting keeps it visually
                  identical to the mockup. */}
              <a href={`${post.slug}.html`} style={{ color: 'inherit' }}>
                {post.title}
              </a>
            </h2>
            <p
              style={{
                fontSize: '16.5px',
                lineHeight: 1.6,
                color: colorVar('--text-dim'),
                maxWidth: '640px',
              }}
            >
              {post.description}
            </p>
            <ArrowLink href={`${post.slug}.html`} style={{ marginTop: '8px' }}>
              Read the post
            </ArrowLink>
          </div>

          <FeaturedVisual />
        </Card>
      </div>
    </div>
  )
}

/** One card in the archive grid. */
function ArchiveCard({ post }: { post: BlogPostSummary }) {
  return (
    <Card
      padding={30}
      style={{ display: 'flex', flexDirection: 'column', gap: `${SPACE.xl}px` }}
    >
      <span
        className="mono"
        style={{ fontSize: '12.5px', color: colorVar('--text-faint') }}
      >
        {post.displayDate}
      </span>
      <h3 style={{ fontSize: `${FONT_SIZE.subhead}px`, lineHeight: 1.3 }}>
        <a href={`${post.slug}.html`} style={{ color: 'inherit' }}>
          {post.title}
        </a>
      </h3>
      <p
        style={{
          fontSize: `${FONT_SIZE.bodySm}px`,
          color: colorVar('--text-dim'),
          lineHeight: 1.55,
        }}
      >
        {post.description}
      </p>
      <ArrowLink
        href={`${post.slug}.html`}
        fontSize={FONT_SIZE.bodySm}
        iconSize={12}
        style={{ marginTop: '4px' }}
      >
        Read more
      </ArrowLink>
    </Card>
  )
}

/** The archive grid below the featured post — every post but the first. */
function ArchiveSection({ posts }: { posts: readonly BlogPostSummary[] }) {
  if (posts.length === 0) return null
  return (
    <div
      className="section-px"
      style={{
        padding: `0 ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.hero}px ${LAYOUT.gutter.desktop}px`,
        position: 'relative',
        zIndex: 1,
      }}
    >
      <div style={{ maxWidth: `${LAYOUT.maxWidth}px`, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: `${SPACE.xl}px`,
            marginBottom: `${SPACE['7xl']}px`,
          }}
        >
          <SectionEyebrow>From the archive</SectionEyebrow>
          <h2
            style={{ fontSize: '30px', letterSpacing: LETTER_SPACING.heading }}
          >
            Earlier posts
          </h2>
        </div>

        <div
          className="archive-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: `${SPACE['3xl'] + 4}px`,
          }}
        >
          {posts.map((post) => (
            <ArchiveCard key={post.slug} post={post} />
          ))}
        </div>
      </div>
    </div>
  )
}

export interface BlogIndexAppProps {
  posts: readonly BlogPostSummary[]
}

/**
 * The blog index's hydrated content: breadcrumb, hero, and either the
 * featured-post + archive grid or the empty state (no posts yet). The
 * exact same function runs on both sides of hydration.
 */
export function BlogIndexApp({ posts }: BlogIndexAppProps) {
  const [featured, ...rest] = posts
  return (
    <>
      <div
        className="section-px"
        style={{
          padding: `${SECTION_SPACE.default}px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.snug}px ${LAYOUT.gutter.desktop}px`,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            maxWidth: `${LAYOUT.maxWidth}px`,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: `${SPACE['2xl']}px`,
          }}
        >
          <BlogBreadcrumb
            crumbs={[{ label: 'Home', href: '../' }, { label: 'Blog' }]}
          />
          <h1
            className="page-h1"
            style={{
              lineHeight: 1.08,
              letterSpacing: LETTER_SPACING.display,
            }}
          >
            Blog
          </h1>
          <p
            style={{
              fontSize: '18px',
              lineHeight: 1.6,
              color: colorVar('--text-dim'),
              maxWidth: '620px',
            }}
          >
            {BLOG_DESCRIPTION}
          </p>
        </div>
      </div>

      {featured === undefined ? (
        <div
          className="section-px"
          style={{
            padding: `0 ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.hero}px ${LAYOUT.gutter.desktop}px`,
          }}
        >
          <div style={{ maxWidth: `${LAYOUT.maxWidth}px`, margin: '0 auto' }}>
            <Card padding={48} style={{ textAlign: 'center' }}>
              <p
                className="empty-state"
                style={{
                  fontSize: `${FONT_SIZE.lead}px`,
                  color: colorVar('--text-dim'),
                }}
              >
                No posts yet — check back soon.
              </p>
            </Card>
          </div>
        </div>
      ) : (
        <>
          <FeaturedPost post={featured} />
          <ArchiveSection posts={rest} />
        </>
      )}
    </>
  )
}
