/**
 * Appends one bench.ts JSON summary to a tracked, append-only history file
 * (bench-history.jsonl) so performance drift can be tracked across
 * weeks/months of CI runs — not just diffed against the one static
 * baseline (bench-baseline.json) that scripts/bench-compare.ts gates each
 * run against.
 *
 * Format: JSON Lines (one JSON object per line), not a single top-level
 * JSON array — an append is then just "read the file, add a line, write it
 * back" without re-serializing or re-indenting the whole history, and a
 * `git diff` on a normal append only ever shows one new line.
 *
 * Usage:
 *   tsx scripts/bench-history-append.ts <current.json> [--history=<path>] [--commit=<sha>] [--ref=<ref>] [--max-entries=<n>]
 *
 *   <current.json>  A bench.ts `--json=` summary (see bench.ts's header for
 *                   that contract) to append.
 *   --history       Path to the history file. Defaults to
 *                   bench-history.jsonl.
 *   --commit        Commit SHA to record with this entry. Defaults to
 *                   $GITHUB_SHA, else 'unknown'.
 *   --ref           Git ref to record (e.g. refs/heads/main). Defaults to
 *                   $GITHUB_REF, else 'unknown'.
 *   --max-entries   Oldest entries beyond this count are dropped so the
 *                   file doesn't grow without bound. Defaults to 520
 *                   (10 years' worth at one entry/week) — just a cap, tune
 *                   freely.
 *
 * Intended to run once a week against main (see .github/workflows/
 * bench-trend.yml), not once per merge or once per PR. This used to run
 * once per merge to main, but that ties the trend's cadence to how often
 * *anything* gets merged rather than to actual elapsed time — in a repo
 * merging many PRs a day, that produced far more "record benchmark trend
 * entry" PRs than any maintainer could keep up with (24 were open at once,
 * none ever merged). A schedule keeps the recorded cadence intentional
 * regardless of merge volume, and a PR branch's bench run still shouldn't
 * feed this file — it doesn't represent a durable point in the project's
 * history the way a commit that actually landed on main does.
 *
 * IMPORTANT: like bench-baseline.json (see scripts/bench-compare.ts's
 * header), entries should only ever come from a GitHub Actions runner, not
 * a local machine — a local run measures meaningfully faster than the
 * shared ubuntu-latest runner, so mixing the two into one trend would read
 * as a fake regression or improvement depending on which source a given
 * point came from.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// ============================================================================
// Types
// ============================================================================

interface BenchCategorySummary {
  sampleCount: number
  svgMs: number
  asciiMs: number
}

/** The shape bench.ts's `--json=` output writes. */
interface BenchSummary {
  generatedAt: string
  sampleCount: number
  svgTotalMs: number
  asciiTotalMs: number
  categories: Record<string, BenchCategorySummary>
}

/** One row of bench-history.jsonl: a BenchSummary plus provenance. */
export interface BenchHistoryEntry extends BenchSummary {
  commit: string
  ref: string
}

// ============================================================================
// Pure helpers (exported for tests)
// ============================================================================

/**
 * Parses an existing JSONL history file into entries, tolerating a missing
 * file (the very first run, before bench-history.jsonl exists yet).
 */
export async function readHistory(path: string): Promise<BenchHistoryEntry[]> {
  let raw: string
  try {
    raw = await readFile(path, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as BenchHistoryEntry)
}

/**
 * Appends `entry` and trims to the most recent `maxEntries`, dropping the
 * oldest first if the cap is exceeded.
 */
export function appendEntry(
  entries: BenchHistoryEntry[],
  entry: BenchHistoryEntry,
  maxEntries: number,
): BenchHistoryEntry[] {
  const next = [...entries, entry]
  return next.length > maxEntries ? next.slice(next.length - maxEntries) : next
}

export function serializeHistory(entries: BenchHistoryEntry[]): string {
  if (entries.length === 0) return ''
  return entries.map((e) => JSON.stringify(e)).join('\n') + '\n'
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const scriptArgs = process.argv.slice(2).filter((a) => a !== '--')

  function argValue(flag: string): string | null {
    const arg = scriptArgs.find((a) => a.startsWith(flag))
    return arg ? arg.slice(flag.length) : null
  }

  const currentPath = scriptArgs.find((a) => !a.startsWith('--'))
  if (!currentPath) {
    console.error(
      'Usage: tsx scripts/bench-history-append.ts <current.json> [--history=<path>] [--commit=<sha>] [--ref=<ref>] [--max-entries=<n>]',
    )
    process.exit(2)
  }

  const historyPath = argValue('--history=') ?? 'bench-history.jsonl'
  const commit = argValue('--commit=') ?? process.env.GITHUB_SHA ?? 'unknown'
  const ref = argValue('--ref=') ?? process.env.GITHUB_REF ?? 'unknown'
  const maxEntries = Number(argValue('--max-entries=') ?? '520')

  const raw = await readFile(currentPath, 'utf-8')
  const summary = JSON.parse(raw) as BenchSummary
  const entry: BenchHistoryEntry = { ...summary, commit, ref }

  const existing = await readHistory(historyPath)
  const updated = appendEntry(existing, entry, maxEntries)
  await writeFile(historyPath, serializeHistory(updated), 'utf-8')

  console.log(
    `Appended entry (commit ${commit.slice(0, 7)}) to ${historyPath} (${updated.length} entries, cap ${maxEntries}).`,
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main()
}
