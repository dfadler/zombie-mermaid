/**
 * Refreshes demo/dashboard-data.json — the snapshot dashboard.ts renders.
 *
 * Usage: `pnpm run dashboard:data` (needs the `gh` CLI, authenticated —
 * `gh auth status` to check).
 *
 * This is deliberately NOT part of `build:site`. `build:site` runs on every
 * PR (ci.yml's `build-site` job) and on every push to main (pages.yml) —
 * making either of those hit the live GitHub API would put a network
 * dependency (and rate-limit exposure) on CI paths that are otherwise fully
 * hermetic. Instead, `.github/workflows/dashboard-refresh.yml` runs this
 * script on its own weekly schedule and commits the refreshed
 * `demo/dashboard-data.json` to `main` if it changed (you can still run it
 * by hand between scheduled runs). `dashboard.ts` only ever reads that
 * committed file. The dashboard page shows `generatedAt` prominently so
 * readers know it's a periodic snapshot, not a live feed.
 *
 * Data sources, all read-only:
 *  - `gh api repos/<owner>/<repo>` — push recency, open issue count
 *  - `gh api search/issues` — merged/open PR counts (search API counts both
 *    repos' issues+PRs together, so `is:pr`/`is:issue` filters are required)
 *  - `gh api repos/<owner>/<repo>/releases` — release counts
 *  - `gh api graphql` — batch-fetch the state of every upstream issue
 *    referenced by demo/fork-fixes-data.ts, in one call
 *  - `gh api repos/dfadler/zombie-mermaid/issues/<n>/comments` — first-
 *    comment timestamp, for a rough response-time figure
 */

import { execFile } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { forkFixes as defaultForkFixes } from '../demo/fork-fixes-data.ts'
import type { ForkFix } from '../demo/fork-fixes-data.ts'

const exec = promisify(execFile)

export const FORK = { owner: 'dfadler', name: 'zombie-mermaid' }
export const UPSTREAM = { owner: 'lukilabs', name: 'beautiful-mermaid' }

/**
 * Signature every fetch* function below depends on instead of calling `gh`
 * directly — lets tests supply canned responses without mocking
 * node:child_process/execFile's promisify plumbing.
 */
export type GhFn = (args: string[]) => Promise<string>

export async function gh(args: string[]): Promise<string> {
  const { stdout } = await exec('gh', args, { maxBuffer: 16 * 1024 * 1024 })
  return stdout
}

async function ghJson<T>(ghFn: GhFn, args: string[]): Promise<T> {
  return JSON.parse(await ghFn(args)) as T
}

export interface RepoStats {
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

export async function fetchRepoStats(
  repo: { owner: string; name: string },
  ghFn: GhFn = gh,
): Promise<RepoStats> {
  const slug = `${repo.owner}/${repo.name}`

  const info = await ghJson<{
    pushed_at: string
    open_issues_count: number
  }>(ghFn, ['api', `repos/${slug}`, '--jq', 'tostring'])
  // open_issues_count from the repo API counts *issues and PRs together* per
  // GitHub's own docs — the search-API counts below are used for anything
  // that needs issues and PRs told apart.

  const [openIssues, openPRs, mergedPRs, releases] = await Promise.all([
    ghJson<{ total_count: number }>(ghFn, [
      'api',
      'search/issues',
      '-X',
      'GET',
      '-f',
      `q=repo:${slug} is:issue is:open`,
      '--jq',
      'tostring',
    ]),
    ghJson<{ total_count: number }>(ghFn, [
      'api',
      'search/issues',
      '-X',
      'GET',
      '-f',
      `q=repo:${slug} is:pr is:open`,
      '--jq',
      'tostring',
    ]),
    ghJson<{ total_count: number }>(ghFn, [
      'api',
      'search/issues',
      '-X',
      'GET',
      '-f',
      `q=repo:${slug} is:pr is:merged`,
      '--jq',
      'tostring',
    ]),
    ghJson<Array<{ tag_name: string; published_at: string }>>(ghFn, [
      'api',
      `repos/${slug}/releases`,
      '--jq',
      'tostring',
    ]),
  ])

  return {
    owner: repo.owner,
    name: repo.name,
    url: `https://github.com/${slug}`,
    lastPushedAt: info.pushed_at,
    openIssues: openIssues.total_count,
    openPRs: openPRs.total_count,
    mergedPRs: mergedPRs.total_count,
    releaseCount: releases.length,
    latestRelease: releases[0]
      ? { tag: releases[0].tag_name, publishedAt: releases[0].published_at }
      : null,
  }
}

export interface RescuedIssue {
  number: number
  state: 'open' | 'closed'
  fixId: string
  fixTitle: string
  forkPr: number
}

/**
 * State of every upstream issue any fork-fixes.ts entry claims to fix, one
 * batched GraphQL call rather than one REST call per issue.
 */
export async function fetchRescuedIssues(
  fixes: ForkFix[] = defaultForkFixes,
  ghFn: GhFn = gh,
): Promise<RescuedIssue[]> {
  const byNumber = new Map<
    number,
    { fixId: string; fixTitle: string; forkPr: number }
  >()
  for (const fix of fixes) {
    for (const n of fix.upstreamIssues ?? []) {
      // First fix wins if two entries somehow reference the same upstream
      // issue — good enough for a dashboard credit line, not load-bearing.
      if (!byNumber.has(n)) {
        byNumber.set(n, { fixId: fix.id, fixTitle: fix.title, forkPr: fix.pr })
      }
    }
  }
  const numbers = [...byNumber.keys()]
  if (numbers.length === 0) return []

  const fields = numbers
    .map((n) => `i${n}: issue(number: ${n}) { number state }`)
    .join('\n    ')
  const query = `query {\n  repository(owner: "${UPSTREAM.owner}", name: "${UPSTREAM.name}") {\n    ${fields}\n  }\n}`

  const result = await ghJson<{
    data: { repository: Record<string, { number: number; state: string }> }
  }>(ghFn, ['api', 'graphql', '-f', `query=${query}`, '--jq', 'tostring'])

  return Object.values(result.data.repository).map((issue) => {
    const meta = byNumber.get(issue.number)!
    return {
      number: issue.number,
      state: issue.state === 'OPEN' ? 'open' : 'closed',
      fixId: meta.fixId,
      fixTitle: meta.fixTitle,
      forkPr: meta.forkPr,
    }
  })
}

export interface ResponseTimeStats {
  sampleSize: number
  medianHours: number
  note: string
}

/**
 * Rough "time to first response" figure: median hours from an issue's
 * creation to its first comment, over the most recent commented issues.
 *
 * zombie-mermaid is a low-traffic, solo-maintained fork, so this is a small
 * and noisy sample (often the maintainer's own follow-up, not a distinct
 * responder) — presented with an explicit caveat rather than as an SLA.
 */
export async function fetchResponseTimeStats(
  sampleLimit = 20,
  ghFn: GhFn = gh,
): Promise<ResponseTimeStats | null> {
  const search = await ghJson<{
    items: Array<{
      number: number
      created_at: string
      comments: number
      user: { login: string }
    }>
  }>(ghFn, [
    'api',
    'search/issues',
    '-X',
    'GET',
    '-f',
    `q=repo:${FORK.owner}/${FORK.name} is:issue comments:>0`,
    '-f',
    'sort=created',
    '-f',
    'order=desc',
    '-f',
    `per_page=${sampleLimit}`,
    '--jq',
    'tostring',
  ])

  const hours: number[] = []
  for (const item of search.items) {
    const comments = await ghJson<
      Array<{ created_at: string; user: { login: string } }>
    >(ghFn, [
      'api',
      `repos/${FORK.owner}/${FORK.name}/issues/${item.number}/comments`,
      '--jq',
      'tostring',
    ])
    // The issue author's own follow-up comment isn't a response — find the
    // first comment from someone else, matching this metric's actual name
    // (response time, not first-comment time).
    const first = comments.find(
      (comment) => comment.user.login !== item.user.login,
    )
    if (!first) continue
    const diffMs =
      new Date(first.created_at).getTime() - new Date(item.created_at).getTime()
    if (diffMs >= 0) hours.push(diffMs / 3_600_000)
  }

  if (hours.length === 0) return null
  hours.sort((a, b) => a - b)
  const mid = Math.floor(hours.length / 2)
  const median =
    hours.length % 2 === 0 ? (hours[mid - 1]! + hours[mid]!) / 2 : hours[mid]!

  return {
    sampleSize: hours.length,
    medianHours: Math.round(median * 10) / 10,
    note: 'Median time from issue open to first comment, over the most recently commented issues. zombie-mermaid is a low-traffic, solo-maintained fork — treat this as directional, not an SLA.',
  }
}

export async function main() {
  console.log('Fetching repo stats (fork + upstream)...')
  const [fork, upstream] = await Promise.all([
    fetchRepoStats(FORK),
    fetchRepoStats(UPSTREAM),
  ])

  console.log('Fetching rescued-issue states from upstream...')
  const rescuedIssues = await fetchRescuedIssues()

  console.log('Fetching response-time sample...')
  const responseTime = await fetchResponseTimeStats()

  const data = {
    generatedAt: new Date().toISOString(),
    fork,
    upstream,
    rescued: {
      totalFixes: defaultForkFixes.length,
      upstreamIssuesReferenced: rescuedIssues.length,
      upstreamIssuesStillOpen: rescuedIssues.filter((i) => i.state === 'open')
        .length,
      upstreamIssuesClosedIndependently: rescuedIssues.filter(
        (i) => i.state === 'closed',
      ).length,
      issues: rescuedIssues.sort((a, b) => a.number - b.number),
    },
    responseTime,
  }

  const outPath = fileURLToPath(
    new URL('../demo/dashboard-data.json', import.meta.url),
  )
  await writeFile(outPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
  console.log(`Written to ${outPath}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main()
}
