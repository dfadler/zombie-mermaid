/** @jsxRuntime automatic */
/**
 * The maintenance-transparency dashboard page (dashboard.ts →
 * dashboard.html) as React components — the #423 pilot for moving the
 * site's generators off template-literal HTML.
 *
 * Pure functions of `DashboardData`: no I/O, no module-level state. The
 * generator (dashboard.ts) reads the committed snapshot and stylesheet
 * and renders `<DashboardPage>` through demo/render-html.ts; the sub-
 * components are exported so __tests__/dashboard.test.ts can render each
 * in isolation. Every visible string here was carried over verbatim from
 * the template it replaces — the point of the pilot is equivalence, not
 * redesign.
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
  type RescuedIssue,
} from '../dashboard-model.ts'
import { SiteHead } from './site-head.tsx'

const FORK_URL = 'https://github.com/dfadler/zombie-mermaid'
const UPSTREAM_URL = 'https://github.com/lukilabs/beautiful-mermaid'

function latestReleaseCell(release: RepoStats['latestRelease']): string {
  return release ? `${release.tag} (${formatDate(release.publishedAt)})` : '—'
}

export interface CompareTableProps {
  fork: RepoStats
  upstream: RepoStats
  /** The snapshot's `generatedAt`, the instant "N days ago" is measured from. */
  referenceIso: string
}

export function CompareTable({
  fork,
  upstream,
  referenceIso,
}: CompareTableProps) {
  const rows: Array<[label: string, forkValue: string, upstreamValue: string]> =
    [
      [
        'Last commit',
        `${pluralDays(daysSince(fork.lastPushedAt, referenceIso))} ago`,
        `${pluralDays(daysSince(upstream.lastPushedAt, referenceIso))} ago`,
      ],
      ['Open issues', String(fork.openIssues), String(upstream.openIssues)],
      ['Open PRs', String(fork.openPRs), String(upstream.openPRs)],
      ['Merged PRs', String(fork.mergedPRs), String(upstream.mergedPRs)],
      [
        'Releases published',
        String(fork.releaseCount),
        String(upstream.releaseCount),
      ],
      [
        'Latest release',
        latestReleaseCell(fork.latestRelease),
        latestReleaseCell(upstream.latestRelease),
      ],
    ]

  return (
    <div className="dash-compare-wrap">
      <table className="dash-compare">
        <thead>
          <tr>
            <th scope="col">Metric</th>
            <th scope="col">zombie-mermaid (this fork)</th>
            <th scope="col">beautiful-mermaid (upstream)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, forkValue, upstreamValue]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td className="dash-fork-col">{forkValue}</td>
              <td>{upstreamValue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function StatCards({ rescued }: { rescued: DashboardData['rescued'] }) {
  const cards: Array<[value: number, label: string, accent: boolean]> = [
    [rescued.totalFixes, 'Bugs fixed in this fork', true],
    [
      rescued.upstreamIssuesReferenced,
      'Distinct upstream issues those fixes address',
      false,
    ],
    [rescued.upstreamIssuesStillOpen, 'Still open upstream, unfixed', true],
    [
      rescued.upstreamIssuesClosedIndependently,
      'Since closed upstream too',
      false,
    ],
  ]

  return (
    <div className="dash-stats">
      {cards.map(([value, label, accent]) => (
        <div className="dash-stat-card" key={label}>
          <div
            className={
              accent ? 'dash-stat-value dash-accent' : 'dash-stat-value'
            }
          >
            {value}
          </div>
          <div className="dash-stat-label">{label}</div>
        </div>
      ))}
    </div>
  )
}

export function IssueList({ issues }: { issues: RescuedIssue[] }) {
  return (
    <div className="dash-issue-list">
      {issues.map((issue) => (
        // One upstream report is sometimes split across two fix entries, so
        // the issue number alone is not unique — the fix id is.
        <div className="dash-issue-row" key={`${issue.number}-${issue.fixId}`}>
          <span
            className={`dash-issue-badge ${issue.state === 'open' ? 'dash-open' : 'dash-closed'}`}
          >
            {issue.state === 'open' ? 'still open upstream' : 'closed upstream'}
          </span>
          <span className="dash-issue-title">{issue.fixTitle}</span>
          <span className="dash-issue-links">
            <a href={`${UPSTREAM_URL}/issues/${issue.number}`}>
              upstream #{issue.number}
            </a>
            <a href={`${FORK_URL}/pull/${issue.forkPr}`}>
              fixed in PR #{issue.forkPr}
            </a>
            <a href={`fork-fixes.html#${issue.fixId}`}>before/after</a>
          </span>
        </div>
      ))}
    </div>
  )
}

export function ResponseTime({
  responseTime,
}: {
  responseTime: DashboardData['responseTime']
}) {
  if (!responseTime) {
    return (
      <p className="dash-response-note">
        No recent issue with a first comment was found to sample.
      </p>
    )
  }
  return (
    <div className="dash-response">
      <div className="dash-stat-card" style={{ minWidth: '11rem' }}>
        <div className="dash-stat-value dash-accent">
          {responseTime.medianHours < 1 ? '<1' : responseTime.medianHours}h
        </div>
        <div className="dash-stat-label">
          Median time to first response (n={responseTime.sampleSize})
        </div>
      </div>
      <p className="dash-response-note">{responseTime.note}</p>
    </div>
  )
}

export interface DashboardPageProps {
  data: DashboardData
  /** The page's full stylesheet (demo/styles.css + demo/dashboard.css). */
  css: string
}

export function DashboardPage({ data, css }: DashboardPageProps) {
  return (
    <html lang="en">
      <head>
        <SiteHead
          title="Maintenance dashboard — zombie-mermaid"
          description="A factual, snapshot comparison of zombie-mermaid's maintenance activity against upstream beautiful-mermaid: commit recency, issue/PR throughput, and bugs fixed here that remain open upstream."
          css={css}
        />
      </head>
      <body>
        <div className="content-wrapper">
          <header className="dash-header">
            <p className="dash-breadcrumb">
              <a href="index.html">← Back to the gallery</a>
            </p>
            <h1>Maintenance dashboard</h1>
            <p className="dash-intro">
              A factual comparison of this fork's maintenance activity against{' '}
              <a href={UPSTREAM_URL}>upstream beautiful-mermaid</a> — commit
              recency, issue/PR throughput, and bugs fixed here that are still
              open upstream. Every number below is sourced straight from each
              repo's GitHub API, not hand-tallied.
            </p>
            <p className="dash-snapshot-note">
              📸 Snapshot as of {formatDateTime(data.generatedAt)} — refreshed
              periodically, not live. See{' '}
              <a
                href={`${FORK_URL}/blob/main/scripts/generate-dashboard-data.ts`}
              >
                generate-dashboard-data.ts
              </a>
              .
            </p>
          </header>

          <section className="dash-section">
            <h2>Fork vs. upstream</h2>
            <p className="dash-section-intro">
              Head-to-head activity metrics, pulled from the GitHub REST/search
              APIs for both repositories.
            </p>
            <CompareTable
              fork={data.fork}
              upstream={data.upstream}
              referenceIso={data.generatedAt}
            />
          </section>

          <section className="dash-section">
            <h2>Rescued from upstream</h2>
            <p className="dash-section-intro">
              Bugs this fork fixed, cross-referenced against the upstream issue
              each one resolves. See the{' '}
              <a href="fork-fixes.html">full before/after showcase</a> for
              rendered proof of each fix.
            </p>
            <StatCards rescued={data.rescued} />
            <IssueList issues={data.rescued.issues} />
          </section>

          <section className="dash-section">
            <h2>Response time</h2>
            <p className="dash-section-intro">
              How quickly a newly opened issue gets a first reply in this fork.
            </p>
            <ResponseTime responseTime={data.responseTime} />
          </section>

          <footer className="dash-footer">
            <p>
              <a href={FORK_URL}>zombie-mermaid</a> — a fork of{' '}
              <a href={UPSTREAM_URL}>beautiful-mermaid</a>. Data refreshed via{' '}
              <code>pnpm run dashboard:data</code>; see also the{' '}
              <a href={`${FORK_URL}/issues/259`}>
                recurring "state of the fork" report
              </a>
              .
            </p>
          </footer>
        </div>
      </body>
    </html>
  )
}
