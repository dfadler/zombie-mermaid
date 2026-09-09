/** @jsxRuntime automatic */
/**
 * The blog's post pages and index (blog.ts → blog/*.html) as React
 * components, rebuilt in the site redesign's visual system (#607, part of
 * #590/#591).
 *
 * Pure functions of already-computed data: blog.ts still parses the
 * Markdown sources, renders them through marked + shiki, and formats
 * dates. Only the post body arrives here as raw HTML — marked's own output
 * for a file under version control, spliced into `.prose` (the element
 * that already carries the class, so no extra wrapper is introduced).
 *
 * Chrome comes from the shared Nav (#593) and Footer (#594) rather than
 * site-chrome.tsx's older `SiteHeader`/`SiteFooter` — this is the first of
 * #598-610's per-page cutovers, so there is no sibling page yet to crib a
 * "how does a redesigned page wire up Nav/Footer/tokens" pattern from;
 * everything below is derived directly from tokens.tsx, primitives.tsx,
 * nav.tsx, footer.tsx and icons.tsx. site-chrome.tsx itself is left
 * untouched (other in-flight pages still render through it) — the only
 * thing imported from it is the `FORK_URL` constant, so the GitHub links
 * below don't duplicate that string a second time.
 *
 * Layout for the index (blog/index.html — featured post + archive grid) is
 * a faithful rebuild of the `Blog.dc.html` artboard in the design canvas
 * linked from #590 (`https://claude.ai/code/artifact/2f623662-…`). Two
 * deliberate departures from that mockup, both functional rather than
 * visual:
 *
 * - The mockup's featured-post visual is a bespoke ASCII-vs-mermaid-ascii
 *   comparison graphic illustrating one specific post
 *   (blog-posts/for-mermaid-ascii-users.md). That doesn't generalise —
 *   whichever post is newest becomes "featured", and most posts aren't
 *   about mermaid-ascii — so {@link FeaturedVisual} instead reuses the
 *   brand mark (icons.tsx's `LogoMark`) in a glowing card, the same gentle
 *   float treatment the mockup uses, without inventing content tied to a
 *   post's subject matter.
 * - The mockup's three archive cards are marked "Placeholder" and carry a
 *   one-off decorative icon each (a bolt, a sun, a cube) that doesn't map
 *   to any real post's content or to anything in icons.tsx's set. Real
 *   archive cards ({@link ArchiveCard}) drop both — there is no per-post
 *   icon to draw from, and "Placeholder" was literally marking that
 *   mockup content as fake.
 * - The mockup's h2/h3 post titles are bare text; the actual link is a
 *   separate small "Read more" arrow-link below. That's fine for a static
 *   mockup, but a real page wraps the title in a link too (colour
 *   inherited, so it reads identically) for a larger, more conventional
 *   click target — matching what this file's pre-redesign version already
 *   did.
 *
 * There is no mockup for the post-page template (`BlogPostPage`) — see
 * that function's own doc comment for the reasoning behind its layout.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { CSSProperties, ReactNode } from 'react'
import { Fragment } from 'react'
import { ArrowRightIcon, ChevronRightIcon, LogoMark } from './icons.tsx'
import { CTA, Card, Pill, SectionEyebrow } from './primitives.tsx'
import { FORK_URL } from './site-chrome.tsx'
import { Footer, type FooterColumn } from './footer.tsx'
import { NavMobileMenuScript, type NavKey } from './nav.tsx'
import { NavIsland } from './nav-island.tsx'
import { ThemePickerSection } from './theme-picker-section.tsx'
import {
  DesignFontLinks,
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  LETTER_SPACING,
  SECTION_SPACE,
  SPACE,
  colorVar,
} from './tokens.tsx'

/** The blog's own one-line description, reused as the index page's lede. */
export const BLOG_DESCRIPTION =
  "Updates on zombie-mermaid, and notes on what it's like maintaining it."

/**
 * Every blog page lives one directory below the site root
 * (blog/index.html, blog/<slug>.html), so the relative destinations below
 * are shared between {@link BlogIndexPage} and {@link BlogPostPage}.
 * `'blog'` points at `'./'` — the blog section's own hub — rather than
 * nav.tsx's `NAV_ITEMS` placeholder, since both page types already sit
 * inside blog/.
 */
const NAV_HREFS: Partial<Record<NavKey, string>> = {
  diagrams: '../diagrams/',
  editor: '../editor',
  forkFixes: '../fork-fixes',
  blog: './',
  github: FORK_URL,
}

/** {@link Footer}'s three link columns, with real destinations in place of
 * footer.tsx's `#anchor` mockup placeholders. Shared for the same reason
 * as {@link NAV_HREFS}. */
const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Diagrams', href: '../diagrams/' },
      { label: 'Editor', href: '../editor' },
      { label: 'Fork fixes', href: '../fork-fixes' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Blog', href: './' },
      { label: 'GitHub', href: FORK_URL },
      {
        label: 'npm package',
        href: 'https://www.npmjs.com/package/zombie-mermaid',
      },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'MIT Licensed' },
      { label: 'dfadler/zombie-mermaid', href: FORK_URL },
    ],
  },
]

/* -----------------------------------------------------------------
 * Document shell
 *
 * A page-local replacement for site-chrome.tsx's `StaticPage`: same
 * meta/canonical/Open Graph shape, but DesignFontLinks (Space Grotesk +
 * Plus Jakarta Sans) instead of StaticPage's Geist + JetBrains Mono. Kept
 * local rather than added to site-chrome.tsx, which stays untouched for
 * the pages that haven't been redesigned yet.
 * ----------------------------------------------------------------- */

interface BlogDocumentProps {
  title: string
  description: string
  canonical: string
  cssHref: string
  faviconHref: string
  ogType?: string
  publishedTime?: string
  children: ReactNode
}

function BlogDocument({
  title,
  description,
  canonical,
  cssHref,
  faviconHref,
  ogType = 'website',
  publishedTime,
  children,
}: BlogDocumentProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content={ogType} />
        <meta property="og:url" content={canonical} />
        {ogType === 'article' && publishedTime ? (
          <meta property="article:published_time" content={publishedTime} />
        ) : null}
        <meta name="twitter:card" content="summary" />
        <link rel="icon" type="image/svg+xml" href={faviconHref} />
        <DesignFontLinks />
        <link rel="stylesheet" href={cssHref} />
      </head>
      <body style={{ background: colorVar('--bg') }}>{children}</body>
    </html>
  )
}

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
 * Post page
 * ----------------------------------------------------------------- */

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
  /**
   * The bundled `demo/nav-only-client.tsx` entry (zombie-mermaid#800) that
   * hydrates `<Nav>`, inlined into its own `<script type="module">` — see
   * editor-page.tsx's `EditorPageProps.navClientScript` doc comment for why
   * it stays a separate tag rather than being concatenated with any other
   * script.
   */
  navClientScript: string
}

/**
 * One blog post, e.g. blog/shipping-v1-of-a-zombie.html.
 *
 * #607's issue explicitly notes the design canvas has no mockup for a post
 * page — only the index. This layout is therefore this file's own
 * extrapolation from the index mockup and the shared component library,
 * not a transcription:
 *
 * - The title renders at tokens.tsx's `FONT_SIZE.h1` (38px), not the
 *   index's 52px `.page-h1` treatment. The index is a section hub — the
 *   canvas gives every hub-level page (Home, Blog, the diagram gallery)
 *   that oversized display heading — while a single post is a leaf content
 *   page, which the design system's own scale reserves the plain `h1`
 *   step for.
 * - The date renders as the same `mono` {@link Pill} the index's featured
 *   card uses for its date, rather than inventing a second treatment for
 *   the same piece of metadata — a post reached directly (a search result,
 *   a shared link, RSS) gets the same "date pill" affordance a reader
 *   would already recognise from the index.
 * - The body sits in a `LAYOUT.proseMaxWidth` (680px) column — the same
 *   measure tokens.tsx documents as "long-form prose, so a line stays
 *   readable" — under `LINE_HEIGHT.prose` (1.9), rather than the wider
 *   1280px column the index's cards and grid use.
 * - "More posts" is the design system's own {@link CTA} (violet, solid,
 *   with the shared trailing-arrow glyph) instead of the pre-redesign
 *   `.cta-btn`, matching the primary-action treatment used everywhere else
 *   in the new system.
 */
export function BlogPostPage({
  title,
  displayDate,
  description,
  canonical,
  cssHref,
  faviconHref,
  publishedTime,
  bodyHtml,
  navClientScript,
}: BlogPostPageProps) {
  return (
    <BlogDocument
      title={`${title} | Zombie Mermaid Blog`}
      description={description}
      canonical={canonical}
      cssHref={cssHref}
      faviconHref={faviconHref}
      ogType="article"
      publishedTime={publishedTime}
    >
      <div
        style={{
          background: `linear-gradient(180deg, ${colorVar('--bg')} 0%, ${colorVar(
            '--bg-soft',
          )} 40%, ${colorVar('--bg')} 100%)`,
        }}
      >
        <NavIsland active="blog" homeHref="../" hrefs={NAV_HREFS} />

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

        <Footer columns={FOOTER_COLUMNS} />
        <script
          type="module"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own demo/nav-only-client.tsx bundle, under version control and produced at build time; never live/runtime user input
          dangerouslySetInnerHTML={{ __html: navClientScript }}
        />
        <NavMobileMenuScript />
      </div>
    </BlogDocument>
  )
}

/* -----------------------------------------------------------------
 * Index page
 * ----------------------------------------------------------------- */

export interface BlogPostSummary {
  slug: string
  title: string
  /** Already formatted for display, e.g. "March 4, 2026". */
  displayDate: string
  description: string
}

export interface BlogIndexPageProps {
  canonical: string
  cssHref: string
  faviconHref: string
  posts: readonly BlogPostSummary[]
  /**
   * The bundled `demo/theme-bar-only-client.ts` script (#687), inlined so
   * the index's `ThemePickerSection` is interactive.
   */
  themeBarScript: string
  /**
   * The bundled `demo/nav-only-client.tsx` entry (zombie-mermaid#800) that
   * hydrates `<Nav>`, inlined into its own `<script type="module">` — see
   * editor-page.tsx's `EditorPageProps.navClientScript` doc comment for why
   * it stays a separate tag rather than being concatenated with any other
   * script.
   */
  navClientScript: string
}

/**
 * A generic, brand-consistent stand-in for the mockup's bespoke
 * mermaid-ascii-comparison graphic — see this file's header comment for
 * why the real one doesn't generalise across posts. Reuses the shared
 * `LogoMark` inside a `glow`-tone {@link Card}, with the same gentle float
 * the mockup's own visual uses (`.float-anim`, defined in demo/blog.css,
 * with a `prefers-reduced-motion` guard).
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
                  clickable for a larger hit target — see this file's header
                  comment. Inheriting keeps it visually identical to the mockup. */}
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

/** blog/index.html — the featured post plus the archive grid, newest first. */
export function BlogIndexPage({
  canonical,
  cssHref,
  faviconHref,
  posts,
  themeBarScript,
  navClientScript,
}: BlogIndexPageProps) {
  const [featured, ...rest] = posts
  return (
    <BlogDocument
      title="Blog | Zombie Mermaid"
      description={BLOG_DESCRIPTION}
      canonical={canonical}
      cssHref={cssHref}
      faviconHref={faviconHref}
    >
      <div
        style={{
          background: `linear-gradient(180deg, ${colorVar('--bg')} 0%, ${colorVar(
            '--bg-soft',
          )} 40%, ${colorVar('--bg')} 100%)`,
        }}
      >
        <NavIsland active="blog" homeHref="../" hrefs={NAV_HREFS} />

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

        <ThemePickerSection tinted />

        <Footer columns={FOOTER_COLUMNS} />
        <script
          type="module"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own demo/theme-bar-only-client.ts bundle, under version control and produced at build time; never live/runtime user input
          dangerouslySetInnerHTML={{ __html: themeBarScript }}
        />
        <script
          type="module"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own demo/nav-only-client.tsx bundle, under version control and produced at build time; never live/runtime user input
          dangerouslySetInnerHTML={{ __html: navClientScript }}
        />
        <NavMobileMenuScript />
      </div>
    </BlogDocument>
  )
}
