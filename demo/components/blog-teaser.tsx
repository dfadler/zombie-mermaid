/** @jsxRuntime automatic */
/**
 * The real newest post, linking to Blog.
 *
 * Split out of `index-app.tsx` into its own file (zombie-mermaid#932).
 */
import { Card, Pill } from './primitives.tsx'
import {
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  SECTION_SPACE,
  SPACE,
  colorVar,
} from './tokens.tsx'

/**
 * The real current newest post (`blog-posts/ascii-and-svg-renderer-now-standalone.md`), picked by
 * the same rule `blog.ts`'s `loadPosts()` uses (newest `date`, ties broken
 * by directory read order) rather than invented.
 */
const LATEST_POST = {
  slug: 'ascii-and-svg-renderer-now-standalone',
  title: 'ascii-renderer and svg-renderer are now standalone packages',
  displayDate: 'Sep 21, 2026',
  description:
    '@zombie-mermaid/ascii-renderer and @zombie-mermaid/svg-renderer are now documented, supported standalone packages on npm — install just the piece you need instead of the whole umbrella.',
} as const

export function BlogTeaser() {
  return (
    <div
      id="blog"
      className="section-px"
      style={{
        padding: `80px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.hero}px ${LAYOUT.gutter.desktop}px`,
      }}
    >
      <Card
        className="blog-teaser-card"
        padding={40}
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'flex',
          // align-items lives in homePageCss() instead of here (not
          // inline) so its mobile breakpoint override can win via plain
          // cascade order instead of needing !important to beat this
          // inline style (zombie-mermaid#1080).
          justifyContent: 'space-between',
          gap: `${SPACE['5xl']}px`,
        }}
      >
        <div
          className="blog-teaser-inner"
          style={{
            display: 'flex',
            // align-items/gap live in homePageCss() instead of here (not
            // inline) so its mobile breakpoint override can win via
            // plain cascade order instead of needing !important to beat
            // this inline style (zombie-mermaid#1080).
          }}
        >
          <Pill
            mono
            style={{
              background: colorVar('--panel-2'),
              border: `1px solid ${colorVar('--border')}`,
              color: colorVar('--text-faint'),
              fontSize: `${FONT_SIZE.label}px`,
            }}
          >
            {LATEST_POST.displayDate}
          </Pill>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: `${SPACE.xs}px`,
              maxWidth: '560px',
            }}
          >
            <h3 style={{ fontSize: '21px' }}>
              <a
                href={`blog/${LATEST_POST.slug}.html`}
                style={{ color: colorVar('--text') }}
              >
                {LATEST_POST.title}
              </a>
            </h3>
            <p
              style={{
                fontSize: `${FONT_SIZE.body}px`,
                color: colorVar('--text-dim'),
                lineHeight: 1.5,
              }}
            >
              {LATEST_POST.description}
            </p>
          </div>
        </div>
        <a
          href="blog/"
          style={{
            fontSize: `${FONT_SIZE.bodyLg}px`,
            fontWeight: FONT_WEIGHT.bold,
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: `${SPACE.xxs}px`,
          }}
        >
          Read the blog
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
      </Card>
    </div>
  )
}
