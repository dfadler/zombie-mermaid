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
