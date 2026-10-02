/**
 * Enumerates upstream `lukilabs/beautiful-mermaid`'s open PRs as a triage
 * list for the PR-rescue campaign (issue #258): "review upstream's open PRs
 * for mergeable fixes/features, cherry-pick/rebase the good ones into
 * zombie-mermaid crediting the original author, then comment back upstream."
 *
 * This script only does the read-only enumeration step. Deciding which PRs
 * are actually worth rescuing (code quality, whether the fix still applies,
 * license/attribution), doing the cherry-pick/rebase, and commenting on the
 * upstream PR all require human (or a specifically-scoped agent) judgment
 * and are deliberately out of scope here — see #258 for the full campaign.
 *
 * Usage: `pnpm run upstream:pr-candidates` (needs the `gh` CLI, authenticated
 * — `gh auth status` to check; read-only, no scopes beyond public-repo read
 * are required since the target repo is public).
 *
 * Flags:
 *   --json   print the raw candidate array as JSON instead of a Markdown table
 *   --limit  cap how many PRs to fetch (default 100)
 *   --seen=<file>  only report PRs whose number isn't in this JSON array of
 *            already-triaged PR numbers (missing file = nothing seen yet)
 *   --write-seen  with --seen, rewrite that file with every currently-open
 *            PR number (sorted), so closed/merged upstream PRs drop out
 *
 * `.github/workflows/upstream-pr-rescue.yml` runs this weekly with
 * `--seen=docs/promotion/upstream-pr-seen.json --write-seen` and opens a PR
 * when new candidates show up.
 */

import { execFile } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const exec = promisify(execFile)

export const UPSTREAM = { owner: 'lukilabs', name: 'beautiful-mermaid' }

/**
 * Signature every fetch* function below depends on instead of calling `gh`
 * directly — lets tests supply canned responses without mocking
 * node:child_process/execFile's promisify plumbing. Same pattern as
 * scripts/generate-dashboard-data.ts's `GhFn`.
 */
export type GhFn = (args: string[]) => Promise<string>

export async function gh(args: string[]): Promise<string> {
  const { stdout } = await exec('gh', args, { maxBuffer: 16 * 1024 * 1024 })
  return stdout
}

interface RawPr {
  number: number
  title: string
  url: string
  createdAt: string
  isDraft: boolean
  mergeable: string
  additions: number
  deletions: number
  changedFiles: number
  labels: Array<{ name: string }>
  author: { login: string; name: string | null }
}

export interface RescueCandidate {
  number: number
  title: string
  url: string
  createdAt: string
  ageDays: number
  author: string
  isDraft: boolean
  mergeable: string
  additions: number
  deletions: number
  changedFiles: number
  labels: string[]
}

/**
 * Fetches upstream's open PRs, oldest first — matching the campaign's own
 * framing ("the oldest over half a year old").
 */
export async function fetchRescueCandidates(
  limit = 100,
  ghFn: GhFn = gh,
  now: Date = new Date(),
): Promise<RescueCandidate[]> {
  const stdout = await ghFn([
    'pr',
    'list',
    '--repo',
    `${UPSTREAM.owner}/${UPSTREAM.name}`,
    '--state',
    'open',
    '--limit',
    String(limit),
    '--json',
    'number,title,author,createdAt,url,additions,deletions,changedFiles,isDraft,mergeable,labels',
  ])
  const raw = JSON.parse(stdout) as RawPr[]

  return raw
    .map((pr) => ({
      number: pr.number,
      title: pr.title,
      url: pr.url,
      createdAt: pr.createdAt,
      ageDays: Math.floor(
        (now.getTime() - new Date(pr.createdAt).getTime()) / 86_400_000,
      ),
      author: pr.author.login,
      isDraft: pr.isDraft,
      mergeable: pr.mergeable,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changedFiles,
      labels: pr.labels.map((l) => l.name),
    }))
    .sort((a, b) => b.ageDays - a.ageDays)
}

/** Candidates whose PR number isn't in `seen`. */
export function filterUnseen(
  candidates: RescueCandidate[],
  seen: readonly number[],
): RescueCandidate[] {
  const seenSet = new Set(seen)
  return candidates.filter((c) => !seenSet.has(c.number))
}

function readSeen(path: string): number[] {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
  const parsed: unknown = JSON.parse(text)
  if (!Array.isArray(parsed) || !parsed.every((n) => typeof n === 'number')) {
    throw new Error(`${path} must be a JSON array of PR numbers`)
  }
  return parsed
}

function toMarkdownTable(candidates: RescueCandidate[]): string {
  const header =
    '| PR | Age (days) | Author | Title | +/- | Files | Draft | Mergeable |\n' +
    '| -- | ----------: | ------ | ----- | --: | ----: | :---: | --------- |'
  const rows = candidates.map((c) => {
    const title = c.title.replace(/\|/g, '\\|')
    return `| [#${c.number}](${c.url}) | ${c.ageDays} | @${c.author} | ${title} | +${c.additions}/-${c.deletions} | ${c.changedFiles} | ${c.isDraft ? 'yes' : ''} | ${c.mergeable} |`
  })
  return [header, ...rows].join('\n')
}

export async function main() {
  const args = process.argv.slice(2)
  const asJson = args.includes('--json')
  const limitArg = args.find((a) => a.startsWith('--limit='))
  const limit = limitArg ? Number(limitArg.split('=')[1]) : 100

  const seenArg = args.find((a) => a.startsWith('--seen='))
  const seenPath = seenArg ? seenArg.slice('--seen='.length) : undefined
  const writeSeen = args.includes('--write-seen')
  if (writeSeen && !seenPath)
    throw new Error('--write-seen requires --seen=<file>')

  const all = await fetchRescueCandidates(limit)
  const candidates = seenPath ? filterUnseen(all, readSeen(seenPath)) : all
  if (seenPath && writeSeen) {
    const numbers = all.map((c) => c.number).sort((a, b) => a - b)
    writeFileSync(seenPath, JSON.stringify(numbers, null, 2) + '\n')
  }

  if (asJson) {
    console.log(JSON.stringify(candidates, null, 2))
    return
  }

  console.log(
    `## Upstream PR-rescue candidates (${UPSTREAM.owner}/${UPSTREAM.name})\n`,
  )
  console.log(
    `${candidates.length} ${seenPath ? 'new ' : ''}open PR(s), oldest first. Generated ${new Date().toISOString()}.\n`,
  )
  if (candidates.length === 0) {
    console.log(seenPath ? 'No new PRs upstream.' : 'No open PRs upstream.')
    return
  }
  console.log(toMarkdownTable(candidates))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main()
}
