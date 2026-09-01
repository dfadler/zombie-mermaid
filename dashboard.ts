/**
 * Generates dashboard.html — a public maintenance-transparency dashboard
 * comparing zombie-mermaid against upstream beautiful-mermaid.
 *
 * Usage: tsx dashboard.ts
 *
 * Unlike index.ts/editor.ts, this page renders a **static snapshot**, not
 * live data: it reads demo/dashboard-data.json, a committed file refreshed
 * by `pnpm run dashboard:data` (scripts/generate-dashboard-data.ts). See
 * that script's header comment for why the GitHub API calls happen there
 * and not here — in short, this generator runs on every PR (ci.yml's
 * `build-site` job) and on every push to main (pages.yml), and neither of
 * those should gain a live network dependency. The page shows
 * `generatedAt` up front so readers know it's a point-in-time snapshot.
 *
 * Addresses zombie-mermaid#265. See also #259 ("state of the fork" report)
 * for a complementary, narrative write-up of similar underlying data — this
 * page is the always-current rendered artifact, not a periodic post.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import dashboardData from './demo/dashboard-data.json' with { type: 'json' }

interface RepoStats {
  owner: string
  name: string
  url: string
  lastPushedAt: string
  openIssues: number
  openPRs: number
  mergedPRs: number
  releaseCount: number
  latestRelease: { tag: string; publishedAt: string } | null
}

interface RescuedIssue {
  number: number
  state: 'open' | 'closed'
  fixId: string
  fixTitle: string
  forkPr: number
}

interface DashboardData {
  generatedAt: string
  fork: RepoStats
  upstream: RepoStats
  rescued: {
    totalFixes: number
    upstreamIssuesReferenced: number
    upstreamIssuesStillOpen: number
    upstreamIssuesClosedIndependently: number
    issues: RescuedIssue[]
  }
  responseTime: {
    sampleSize: number
    medianHours: number
    note: string
  } | null
}

const data = dashboardData as DashboardData

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function daysSince(iso: string): number {
  return Math.floor(
    (new Date(data.generatedAt).getTime() - new Date(iso).getTime()) /
      86_400_000,
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(iso: string): string {
  return (
    new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }) +
    ' at ' +
    new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  )
}

function pluralDays(n: number): string {
  return `${n} day${n === 1 ? '' : 's'}`
}

function renderCompareTable(fork: RepoStats, upstream: RepoStats): string {
  const rows: Array<[string, string, string]> = [
    [
      'Last commit',
      pluralDays(daysSince(fork.lastPushedAt)) + ' ago',
      pluralDays(daysSince(upstream.lastPushedAt)) + ' ago',
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
      fork.latestRelease
        ? `${escapeHtml(fork.latestRelease.tag)} (${formatDate(fork.latestRelease.publishedAt)})`
        : '—',
      upstream.latestRelease
        ? `${escapeHtml(upstream.latestRelease.tag)} (${formatDate(upstream.latestRelease.publishedAt)})`
        : '—',
    ],
  ]

  return `
      <div class="dash-compare-wrap">
        <table class="dash-compare">
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">zombie-mermaid (this fork)</th>
              <th scope="col">beautiful-mermaid (upstream)</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                ([label, forkVal, upstreamVal]) => `<tr>
              <th scope="row">${escapeHtml(label)}</th>
              <td class="dash-fork-col">${forkVal}</td>
              <td>${upstreamVal}</td>
            </tr>`,
              )
              .join('\n            ')}
          </tbody>
        </table>
      </div>`
}

function renderStatCards(rescued: DashboardData['rescued']): string {
  const cards: Array<[string, string, boolean]> = [
    [String(rescued.totalFixes), 'Bugs fixed in this fork', true],
    [
      String(rescued.upstreamIssuesReferenced),
      'Distinct upstream issues those fixes address',
      false,
    ],
    [
      String(rescued.upstreamIssuesStillOpen),
      'Still open upstream, unfixed',
      true,
    ],
    [
      String(rescued.upstreamIssuesClosedIndependently),
      'Since closed upstream too',
      false,
    ],
  ]

  return `
      <div class="dash-stats">
        ${cards
          .map(
            ([value, label, accent]) => `<div class="dash-stat-card">
          <div class="dash-stat-value${accent ? ' dash-accent' : ''}">${value}</div>
          <div class="dash-stat-label">${escapeHtml(label)}</div>
        </div>`,
          )
          .join('\n        ')}
      </div>`
}

function renderIssueList(issues: RescuedIssue[]): string {
  return `
      <div class="dash-issue-list">
        ${issues
          .map((issue) => {
            const badgeClass =
              issue.state === 'open' ? 'dash-open' : 'dash-closed'
            const badgeLabel =
              issue.state === 'open' ? 'still open upstream' : 'closed upstream'
            return `<div class="dash-issue-row">
          <span class="dash-issue-badge ${badgeClass}">${badgeLabel}</span>
          <span class="dash-issue-title">${escapeHtml(issue.fixTitle)}</span>
          <span class="dash-issue-links">
            <a href="https://github.com/lukilabs/beautiful-mermaid/issues/${issue.number}">upstream #${issue.number}</a>
            <a href="https://github.com/dfadler/zombie-mermaid/pull/${issue.forkPr}">fixed in PR #${issue.forkPr}</a>
            <a href="fork-fixes.html#${issue.fixId}">before/after</a>
          </span>
        </div>`
          })
          .join('\n        ')}
      </div>`
}

function renderResponseTime(rt: DashboardData['responseTime']): string {
  if (!rt) {
    return `<p class="dash-response-note">No recent issue with a first comment was found to sample.</p>`
  }
  return `
      <div class="dash-response">
        <div class="dash-stat-card" style="min-width: 11rem;">
          <div class="dash-stat-value dash-accent">${rt.medianHours < 1 ? '<1' : rt.medianHours}h</div>
          <div class="dash-stat-label">Median time to first response (n=${rt.sampleSize})</div>
        </div>
        <p class="dash-response-note">${escapeHtml(rt.note)}</p>
      </div>`
}

async function generate(): Promise<string> {
  const styles = await readFile(
    new URL('./demo/styles.css', import.meta.url),
    'utf8',
  )
  const extra = await readFile(
    new URL('./demo/dashboard.css', import.meta.url),
    'utf8',
  )

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Maintenance dashboard — zombie-mermaid</title>
  <meta name="description" content="A factual, snapshot comparison of zombie-mermaid's maintenance activity against upstream beautiful-mermaid: commit recency, issue/PR throughput, and bugs fixed here that remain open upstream." />
  <link rel="icon" href="favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
${styles}
${extra}
  </style>
</head>
<body>
  <div class="content-wrapper">
    <header class="dash-header">
      <p class="dash-breadcrumb"><a href="index.html">← Back to the gallery</a></p>
      <h1>Maintenance dashboard</h1>
      <p class="dash-intro">
        A factual comparison of this fork's maintenance activity against
        <a href="https://github.com/lukilabs/beautiful-mermaid">upstream beautiful-mermaid</a>
        — commit recency, issue/PR throughput, and bugs fixed here that are
        still open upstream. Every number below is sourced straight from
        each repo's GitHub API, not hand-tallied.
      </p>
      <p class="dash-snapshot-note">
        📸 Snapshot as of ${formatDateTime(data.generatedAt)} — refreshed periodically, not live. See
        <a href="https://github.com/dfadler/zombie-mermaid/blob/main/scripts/generate-dashboard-data.ts">generate-dashboard-data.ts</a>.
      </p>
    </header>

    <section class="dash-section">
      <h2>Fork vs. upstream</h2>
      <p class="dash-section-intro">
        Head-to-head activity metrics, pulled from the GitHub REST/search
        APIs for both repositories.
      </p>
      ${renderCompareTable(data.fork, data.upstream)}
    </section>

    <section class="dash-section">
      <h2>Rescued from upstream</h2>
      <p class="dash-section-intro">
        Bugs this fork fixed, cross-referenced against the upstream issue
        each one resolves. See the
        <a href="fork-fixes.html">full before/after showcase</a> for
        rendered proof of each fix.
      </p>
      ${renderStatCards(data.rescued)}
      ${renderIssueList(data.rescued.issues)}
    </section>

    <section class="dash-section">
      <h2>Response time</h2>
      <p class="dash-section-intro">
        How quickly a newly opened issue gets a first reply in this fork.
      </p>
      ${renderResponseTime(data.responseTime)}
    </section>

    <footer class="dash-footer">
      <p>
        <a href="https://github.com/dfadler/zombie-mermaid">zombie-mermaid</a>
        — a fork of
        <a href="https://github.com/lukilabs/beautiful-mermaid">beautiful-mermaid</a>.
        Data refreshed via <code>pnpm run dashboard:data</code>; see also the
        <a href="https://github.com/dfadler/zombie-mermaid/issues/259">recurring "state of the fork" report</a>.
      </p>
    </footer>
  </div>
</body>
</html>`
}

const html = await generate()
const outPath = fileURLToPath(new URL('./dashboard.html', import.meta.url))
await writeFile(outPath, html, 'utf8')
console.log(`Written to ${outPath} (${(html.length / 1024).toFixed(1)} KB)`)
