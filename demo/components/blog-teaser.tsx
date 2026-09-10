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
 * The real current newest post (`blog-posts/294-prs-14-days.md`), picked by
 * the same rule `blog.ts`'s `loadPosts()` uses (newest `date`, ties broken
 * by directory read order) rather than invented.
 */
const LATEST_POST = {
  slug: '294-prs-14-days',
  title:
    '294 PRs, 14 Days — What Agent-Driven OSS Maintenance Actually Looks Like',
  displayDate: 'Sep 6, 2026',
  description:
    'The real daily merge-count histogram behind two weeks of reviving a dead fork — not the rounder number the tracking issue guessed — and what it does and doesn’t tell you about agent-driven maintenance.',
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
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: `${SPACE['5xl']}px`,
        }}
      >
        <div
          className="blog-teaser-inner"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: `${SPACE['4xl']}px`,
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
