/** @jsxRuntime automatic */
/**
 * The maintenance-transparency dashboard page (dashboard.ts → dashboard.html)
 * rebuilt in the #590 shared visual system (#610) — replacing the bare
 * "← back to the gallery" link and the old `--t-*`-themed `.dash-*` markup
 * with the shared Nav/Footer (#593/#594) and the design canvas's dark,
 * card-based layout (#592 tokens, #595 primitives, #596 icons).
 *
 * Every real number below is still `demo/dashboard-model.ts`'s
 * `DashboardData`, sourced unchanged from the committed
 * `demo/dashboard-data.json` snapshot (see dashboard.ts's header comment and
 * scripts/generate-dashboard-data.ts) — this redesign changes only how that
 * data is displayed, never how it is produced. The one section the canvas's
 * `Dashboard.dc.html` artboard shows without a number — "Rescued issues" —
 * stays deliberately generic here too: no rescued-issue count has been
 * confirmed accurate, so the teaser card names the idea ("a number of
 * them") rather than a figure, exactly as the canvas's own copy does (it
 * does not put a number in that card either).
 *
 * The canvas has no "Response time" section. This page keeps one anyway —
 * it is real data (`DashboardData['responseTime']`) the pre-redesign page
 * already showed, and dropping it would be a silent feature regression the
 * design source never asked for. It is reskinned to match everything else
 * on the page (a `Card`, the shared type scale) rather than left in the old
 * `.dash-response` styling it used before.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import {
  daysSince,
  formatDate,
  formatDateTime,
  pluralDays,
  type DashboardData,
  type RepoStats,
} from '../dashboard-model.ts'
import { Footer } from './footer.tsx'
import {
  ActivityIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
} from './icons.tsx'
import { Nav } from './nav.tsx'
import { Card, CTA, SectionEyebrow, accentVar } from './primitives.tsx'
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

/** The fork's own repository. */
export const FORK_URL = 'https://github.com/dfadler/zombie-mermaid'
/** The upstream repository this fork tracks. */
export const UPSTREAM_URL = 'https://github.com/lukilabs/beautiful-mermaid'
/** The published package, linked from the footer's Resources column. */
const NPM_URL = 'https://www.npmjs.com/package/zombie-mermaid'

/**
 * The site's real routes, relative to dashboard.html's own location in the
 * built `site/` directory (see package.json's `build:site` script, which
 * moves every generator's output into one flat `site/` alongside `blog/`
 * and `diagrams/`).
 */
const ROUTES = {
  home: 'index.html',
  diagrams: 'diagrams/index.html',
  editor: 'editor.html',
  forkFixes: 'fork-fixes.html',
  blog: 'blog/',
} as const

/** The dark green ink primitives.tsx documents for a solid-green CTA/pill — see its `SOLID_INK` note. */
const GREEN_SOLID_INK = '#04140b'

function latestReleaseCell(release: RepoStats['latestRelease']): string {
  return release ? `${release.tag} (${formatDate(release.publishedAt)})` : '—'
}

/** One repo's six head-to-head numbers, in the metrics card's own display order. */
function repoMetricEntries(
  stats: RepoStats,
  referenceIso: string,
): Array<[value: string, label: string]> {
  return [
    [
      `${pluralDays(daysSince(stats.lastPushedAt, referenceIso))} ago`,
      'last commit',
    ],
    [String(stats.openIssues), 'open issues'],
    [String(stats.openPRs), 'open PRs'],
    [String(stats.mergedPRs), 'merged PRs'],
    [String(stats.releaseCount), 'releases published'],
    [latestReleaseCell(stats.latestRelease), 'latest release'],
  ]
}

export interface RepoMetricsCardProps {
  label: string
  stats: RepoStats
  /** The snapshot's own `generatedAt`, the instant "N days ago" is measured from. */
  referenceIso: string
  /**
   * The fork's own card, which the canvas highlights green with a check
   * mark; the upstream card is muted with a clock. Defaults to `false`.
   */
  highlight?: boolean
}

/** One repo's stat card: a label, a status glyph, and its six numbers. */
export function RepoMetricsCard({
  label,
  stats,
  referenceIso,
  highlight = false,
}: RepoMetricsCardProps) {
  const ink = highlight ? accentVar('green') : colorVar('--text-faint')
  return (
    <Card
      accent={highlight ? 'green' : undefined}
      padding={36}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: `${SPACE['7xl']}px`,
        opacity: highlight ? 1 : 0.75,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: `${SPACE.xl}px`,
        }}
      >
        <p
          style={{
            fontSize: `${FONT_SIZE.bodyLg}px`,
            fontWeight: FONT_WEIGHT.bold,
            letterSpacing: '0.02em',
            color: ink,
          }}
        >
          {label}
        </p>
        {highlight ? (
          <CheckIcon size={20} strokeWidth={2.4} />
        ) : (
          <ClockIcon size={20} strokeWidth={2.4} />
        )}
      </div>
      <div
        className="metric-stats"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: `${SPACE['5xl']}px`,
        }}
      >
        {repoMetricEntries(stats, referenceIso).map(([value, metricLabel]) => (
          <div key={metricLabel}>
            <p className="display" style={{ fontSize: '32px', color: ink }}>
              {value}
            </p>
            <p
              style={{
                fontSize: `${FONT_SIZE.caption}px`,
                color: colorVar('--text-dim'),
              }}
            >
              {metricLabel}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}

export interface MetricsSectionProps {
  fork: RepoStats
  upstream: RepoStats
  /** The snapshot's own `generatedAt`. */
  referenceIso: string
}

/** The fork-vs-upstream section: two {@link RepoMetricsCard}s side by side. */
export function MetricsSection({
  fork,
  upstream,
  referenceIso,
}: MetricsSectionProps) {
  return (
    <div
      id="metrics"
      className="section-px"
      style={{
        padding: `${SECTION_SPACE.snug}px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.hero}px ${LAYOUT.gutter.desktop}px`,
        background: colorVar('--bg-soft'),
        borderTop: `1px solid ${colorVar('--border')}`,
        borderBottom: `1px solid ${colorVar('--border')}`,
      }}
    >
      <div
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: `0 auto ${SPACE['7xl']}px auto`,
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xl}px`,
        }}
      >
        <SectionEyebrow>Fork vs. upstream, side by side</SectionEyebrow>
        <h2
          style={{
            fontSize: `${FONT_SIZE.h2}px`,
            letterSpacing: LETTER_SPACING.heading,
          }}
        >
          The numbers, side by side.
        </h2>
        <p
          style={{
            fontSize: `${FONT_SIZE.lead}px`,
            color: colorVar('--text-dim'),
            maxWidth: '640px',
          }}
        >
          Same metrics, same source, no cherry-picking — this fork simply moves
          and upstream mostly doesn't.
        </p>
      </div>

      <div
        className="stats-grid"
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: `${SPACE['5xl']}px`,
        }}
      >
        <RepoMetricsCard
          label="zombie-mermaid (this fork)"
          stats={fork}
          referenceIso={referenceIso}
          highlight
        />
        <RepoMetricsCard
          label="beautiful-mermaid (upstream)"
          stats={upstream}
          referenceIso={referenceIso}
        />
      </div>
    </div>
  )
}

/**
 * The "Rescued issues" teaser: a single card naming the idea and linking to
 * the Fork Fixes page, without a specific count — see this module's header
 * comment on why no number appears here.
 */
export function RescuedTeaser() {
  return (
    <div
      id="rescued"
      className="section-px"
      style={{
        padding: `${SECTION_SPACE.loose}px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.hero}px ${LAYOUT.gutter.desktop}px`,
      }}
    >
      <div
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: `0 auto ${SPACE['6xl']}px auto`,
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xl}px`,
        }}
      >
        <SectionEyebrow>Bugs upstream never got to</SectionEyebrow>
        <h2
          style={{
            fontSize: `${FONT_SIZE.h2}px`,
            letterSpacing: LETTER_SPACING.heading,
          }}
        >
          Still broken upstream. Fixed here.
        </h2>
      </div>

      <Card
        className="rescued-card"
        padding={32}
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: `${SPACE['3xl']}px`,
          background: `linear-gradient(90deg, ${colorVar('--panel')} 0%, ${colorVar('--panel-2')} 100%)`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: `${SPACE['2xl']}px`,
          }}
        >
          <ActivityIcon size={34} strokeWidth={1.8} />
          <div>
            <h3 style={{ fontSize: `${FONT_SIZE.subhead}px` }}>
              Rescued issues
            </h3>
            <p
              style={{
                fontSize: '14.5px',
                color: colorVar('--text-dim'),
                maxWidth: '560px',
              }}
            >
              Some bugs reported against upstream beautiful-mermaid never got
              fixed there. A number of them are already fixed in this fork —
              each one documented before/after on the fork-fixes evidence page.
            </p>
          </div>
        </div>
        <CTA
          href={ROUTES.forkFixes}
          accent="green"
          style={{ color: GREEN_SOLID_INK, whiteSpace: 'nowrap' }}
        >
          See what's fixed
        </CTA>
      </Card>
    </div>
  )
}

export interface ResponseTimeSectionProps {
  responseTime: DashboardData['responseTime']
}

/** How quickly a newly opened issue gets a first reply — real data, not on the design canvas (see this module's header comment). */
export function ResponseTimeSection({
  responseTime,
}: ResponseTimeSectionProps) {
  return (
    <div
      id="response"
      className="section-px"
      style={{
        padding: `${SECTION_SPACE.tight}px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.snug}px ${LAYOUT.gutter.desktop}px`,
      }}
    >
      <div
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: `0 auto ${SPACE['5xl']}px auto`,
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE.xl}px`,
        }}
      >
        <SectionEyebrow>How fast issues get a first reply</SectionEyebrow>
        <h2
          style={{
            fontSize: `${FONT_SIZE.h3}px`,
            letterSpacing: LETTER_SPACING.heading,
          }}
        >
          Response time
        </h2>
      </div>

      <div style={{ maxWidth: `${LAYOUT.maxWidth}px`, margin: '0 auto' }}>
        {responseTime === null ? (
          <p
            style={{
              fontSize: `${FONT_SIZE.body}px`,
              color: colorVar('--text-dim'),
            }}
          >
            No recent issue with a first comment was found to sample.
          </p>
        ) : (
          <Card
            padding={28}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: `${SPACE['3xl']}px`,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <p
                className="display"
                style={{ fontSize: '32px', color: accentVar('cyan') }}
              >
                {responseTime.medianHours < 1 ? '<1' : responseTime.medianHours}
                h
              </p>
              <p
                style={{
                  fontSize: `${FONT_SIZE.caption}px`,
                  color: colorVar('--text-dim'),
                }}
              >
                Median time to first response (n={responseTime.sampleSize})
              </p>
            </div>
            <p
              style={{
                fontSize: `${FONT_SIZE.bodySm}px`,
                color: colorVar('--text-dim'),
                maxWidth: '34rem',
              }}
            >
              {responseTime.note}
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}

const PAGE_DESCRIPTION =
  "A factual, snapshot comparison of zombie-mermaid's maintenance activity against upstream beautiful-mermaid: commit recency, issue/PR throughput, and bugs fixed here that remain open upstream."

export interface DashboardPageProps {
  data: DashboardData
  /** The page's full stylesheet — tokens/primitives/nav/footer CSS plus this page's own (see dashboard.ts). */
  css: string
}

export function DashboardPage({ data, css }: DashboardPageProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Maintenance dashboard — zombie-mermaid</title>
        <meta name="description" content={PAGE_DESCRIPTION} />
        <link rel="icon" href="favicon.svg" type="image/svg+xml" />
        <DesignFontLinks />
        <style>{css}</style>
      </head>
      <body>
        <div
          className="dc-root"
          style={{
            width: '100%',
            maxWidth: '1440px',
            margin: '0 auto',
            background:
              'linear-gradient(180deg, #0a0d16 0%, #0d1120 40%, #0a0d16 100%)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Nav
            homeHref={ROUTES.home}
            hrefs={{
              diagrams: ROUTES.diagrams,
              editor: ROUTES.editor,
              forkFixes: ROUTES.forkFixes,
              blog: ROUTES.blog,
              github: FORK_URL,
            }}
          />

          <div
            className="section-px"
            style={{
              padding: `${SECTION_SPACE.loose}px ${LAYOUT.gutter.desktop}px ${SECTION_SPACE.tight}px ${LAYOUT.gutter.desktop}px`,
            }}
          >
            <div
              style={{
                maxWidth: `${LAYOUT.maxWidth}px`,
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: `${SPACE['3xl']}px`,
              }}
            >
              <div
                className="mono"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: `${SPACE.sm}px`,
                  fontSize: '13.5px',
                  color: colorVar('--text-faint'),
                }}
              >
                <a
                  href={ROUTES.home}
                  style={{ color: colorVar('--text-faint') }}
                >
                  Home
                </a>
                <ChevronRightIcon size={12} strokeWidth={2.4} />
                <span style={{ color: colorVar('--text-dim') }}>Dashboard</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: `${SPACE.xl}px`,
                }}
              >
                <SectionEyebrow>
                  Sourced from the GitHub API, not hand-tallied
                </SectionEyebrow>
                <h1
                  className="page-h1"
                  style={{
                    fontSize: `${FONT_SIZE.h1}px`,
                    lineHeight: 1.1,
                    letterSpacing: LETTER_SPACING.heading,
                    maxWidth: '820px',
                  }}
                >
                  Still shipping every week. Upstream mostly isn't.
                </h1>
                <p
                  style={{
                    fontSize: `${FONT_SIZE.lead}px`,
                    lineHeight: 1.6,
                    color: colorVar('--text-dim'),
                    maxWidth: '680px',
                  }}
                >
                  A factual comparison of this fork's maintenance activity
                  against <a href={UPSTREAM_URL}>upstream beautiful-mermaid</a>{' '}
                  — commit recency, issue and PR throughput, and bugs fixed here
                  that are still open upstream. Every number below is pulled
                  straight from each repo's GitHub API, not hand-tallied.
                </p>
              </div>

              <div
                className="mono"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: `${SPACE.sm}px`,
                  fontSize: `${FONT_SIZE.label}px`,
                  color: colorVar('--text-faint'),
                }}
              >
                <ClockIcon size={13} strokeWidth={2} />
                <span>
                  Snapshot as of {formatDateTime(data.generatedAt)} — refreshed
                  periodically, not live. See{' '}
                  <a
                    href={`${FORK_URL}/blob/main/scripts/generate-dashboard-data.ts`}
                  >
                    generate-dashboard-data.ts
                  </a>
                  .
                </span>
              </div>
            </div>
          </div>

          <MetricsSection
            fork={data.fork}
            upstream={data.upstream}
            referenceIso={data.generatedAt}
          />
          <RescuedTeaser />
          <ResponseTimeSection responseTime={data.responseTime} />

          <Footer
            columns={[
              {
                title: 'Product',
                links: [
                  { label: 'Diagrams', href: ROUTES.diagrams },
                  { label: 'Editor', href: ROUTES.editor },
                  { label: 'Fork fixes', href: ROUTES.forkFixes },
                ],
              },
              {
                title: 'Resources',
                links: [
                  { label: 'Blog', href: ROUTES.blog },
                  { label: 'GitHub', href: FORK_URL },
                  { label: 'npm package', href: NPM_URL },
                ],
              },
              {
                title: 'Project',
                links: [
                  { label: 'MIT Licensed' },
                  { label: 'dfadler/zombie-mermaid', href: FORK_URL },
                ],
              },
            ]}
          />
        </div>
      </body>
    </html>
  )
}
