/**
 * Data model and pure formatting helpers for the maintenance-transparency
 * dashboard (dashboard.ts → dashboard.html).
 *
 * Lives under demo/ rather than in dashboard.ts so the page's React
 * components (demo/components/dashboard-page.tsx) can import it without
 * reaching back into the generator script — dashboard.ts imports the
 * components, so the reverse import would be a cycle — and so it is
 * covered by demo/tsconfig.json's type check, which the root generator
 * scripts are not.
 *
 * The schema validates demo/dashboard-data.json at generation time: that
 * file is a committed snapshot rewritten weekly by
 * scripts/generate-dashboard-data.ts (see .github/workflows/dashboard-
 * refresh.yml), and nothing else checks that what it writes is still the
 * shape this page renders. A mismatch fails `pnpm run dashboard` with a
 * zod error naming the field, instead of rendering `undefined` into the
 * live page.
 */
import { z } from 'zod'

const RepoStatsSchema = z.object({
  owner: z.string(),
  name: z.string(),
  url: z.string(),
  lastPushedAt: z.string(),
  openIssues: z.number(),
  openPRs: z.number(),
  mergedPRs: z.number(),
  releaseCount: z.number(),
  latestRelease: z
    .object({ tag: z.string(), publishedAt: z.string() })
    .nullable(),
})

const RescuedIssueSchema = z.object({
  number: z.number(),
  state: z.enum(['open', 'closed']),
  fixId: z.string(),
  fixTitle: z.string(),
  forkPr: z.number(),
})

export const DashboardDataSchema = z.object({
  generatedAt: z.string(),
  fork: RepoStatsSchema,
  upstream: RepoStatsSchema,
  rescued: z.object({
    totalFixes: z.number(),
    upstreamIssuesReferenced: z.number(),
    upstreamIssuesStillOpen: z.number(),
    upstreamIssuesClosedIndependently: z.number(),
    issues: z.array(RescuedIssueSchema),
  }),
  responseTime: z
    .object({
      sampleSize: z.number(),
      medianHours: z.number(),
      note: z.string(),
    })
    .nullable(),
})

export type RepoStats = z.infer<typeof RepoStatsSchema>
export type RescuedIssue = z.infer<typeof RescuedIssueSchema>
export type DashboardData = z.infer<typeof DashboardDataSchema>

/** Narrows the raw JSON import (or any untrusted value) to `DashboardData`, throwing on a shape mismatch. */
export function parseDashboardData(value: unknown): DashboardData {
  return DashboardDataSchema.parse(value)
}

/** Whole days from `iso` to `referenceIso` (the snapshot's own `generatedAt`), floored. */
export function daysSince(iso: string, referenceIso: string): number {
  return Math.floor(
    (new Date(referenceIso).getTime() - new Date(iso).getTime()) / 86_400_000,
  )
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(iso: string): string {
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

export function pluralDays(n: number): string {
  return `${n} day${n === 1 ? '' : 's'}`
}

/** One repo card's already-formatted display data — see {@link buildDashboardViewModel}. */
export interface RepoMetricsView {
  label: string
  /** The fork's own card renders highlighted (green, checkmark); upstream's does not. */
  highlight: boolean
  /** The six metric tiles, in display order, as `[value, label]` pairs. */
  entries: Array<[value: string, label: string]>
}

/**
 * `dashboard-page.tsx`'s hydratable props: `DashboardData` with every
 * locale/timezone-sensitive formatting step (`formatDate`, `formatDateTime`,
 * both `toLocaleDateString`/`toLocaleTimeString` under the hood) already
 * applied.
 *
 * This exists because of zombie-mermaid#799's hydration work: React's
 * `hydrateRoot()` requires the client's first render to produce byte-
 * identical markup to what the server already sent, and `toLocaleDateString`/
 * `toLocaleTimeString` resolve against the *host's own* locale/timezone —
 * the Node build machine (typically UTC in CI) will not agree with a
 * visitor's browser (their own local timezone) on what `formatDateTime`
 * returns for the same instant, especially with `timeZoneName: 'short'` in
 * play. Computing every such string exactly once, here, on the server, and
 * carrying the *string* (not the raw ISO timestamp) through to the client
 * as a prop closes that gap: the client never calls a locale API at all, so
 * there's nothing left for the two environments to disagree about. `daysSince`
 * (pure epoch-ms arithmetic, no locale/timezone involved) has no such hazard
 * and could safely run on either side, but is folded in here too so every
 * hydrated component receives display-ready strings uniformly rather than a
 * mix of raw and precomputed fields.
 */
export interface DashboardViewModel {
  generatedAtDisplay: string
  fork: RepoMetricsView
  upstream: RepoMetricsView
  responseTime: DashboardData['responseTime']
}

function buildRepoMetricsView(
  label: string,
  stats: RepoStats,
  referenceIso: string,
  highlight: boolean,
): RepoMetricsView {
  return {
    label,
    highlight,
    entries: [
      [
        `${pluralDays(daysSince(stats.lastPushedAt, referenceIso))} ago`,
        'last commit',
      ],
      [String(stats.openIssues), 'open issues'],
      [String(stats.openPRs), 'open PRs'],
      [String(stats.mergedPRs), 'merged PRs'],
      [String(stats.releaseCount), 'releases published'],
      [
        stats.latestRelease
          ? `${stats.latestRelease.tag} (${formatDate(stats.latestRelease.publishedAt)})`
          : '—',
        'latest release',
      ],
    ],
  }
}

/** Builds the fully display-ready view model {@link DashboardPage} hydrates from — see {@link DashboardViewModel}'s doc comment for why this exists. */
export function buildDashboardViewModel(
  data: DashboardData,
): DashboardViewModel {
  return {
    generatedAtDisplay: formatDateTime(data.generatedAt),
    fork: buildRepoMetricsView(
      'zombie-mermaid (this fork)',
      data.fork,
      data.generatedAt,
      true,
    ),
    upstream: buildRepoMetricsView(
      'beautiful-mermaid (upstream)',
      data.upstream,
      data.generatedAt,
      false,
    ),
    responseTime: data.responseTime,
  }
}
