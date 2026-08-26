// Enforces a stricter coverage bar on new/changed code than the repo-wide
// thresholds in vitest.config.ts. Those thresholds guard the whole codebase
// (including long-standing, hard-to-reach branches); this script only looks
// at lines actually touched by the current diff and requires DIFF_THRESHOLD%
// of them to be covered, so new work is held to a higher bar without forcing
// a slow, all-at-once cleanup of existing gaps.
//
// Usage: pnpm run test:coverage && pnpm run coverage:diff
// (relies on coverage/lcov.info from the coverage run above)

import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'

const DIFF_THRESHOLD = 90
const LCOV_PATH = 'coverage/lcov.info'
// Mirrors vitest.config.ts's coverage.include/exclude.
const INCLUDE_DIR = 'src/'
const EXCLUDE_PREFIX = 'src/__tests__/'

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' })
}

/**
 * Picks the ref to diff against: the PR's actual base branch in CI (via
 * `GITHUB_BASE_REF`), falling back to `origin/main`/`main` for local runs.
 * Exported so tests can verify the fallback order against a mocked `git`.
 */
export function resolveBaseRef(): string | null {
  const candidates = [
    process.env.GITHUB_BASE_REF
      ? `origin/${process.env.GITHUB_BASE_REF}`
      : null,
    'origin/main',
    'main',
  ].filter((ref): ref is string => ref !== null)

  for (const ref of candidates) {
    try {
      git(['rev-parse', '--verify', ref])
      return ref
    } catch {
      // try the next candidate
    }
  }
  return null
}

export function isTrackedTsFile(path: string): boolean {
  return (
    path.startsWith(INCLUDE_DIR) &&
    path.endsWith('.ts') &&
    !path.startsWith(EXCLUDE_PREFIX)
  )
}

/**
 * Parses `git diff --unified=0` output into a map of changed file → the set
 * of new-file line numbers that were added/modified. Pure function of the
 * diff text, split out of `getChangedLines()` so it's testable without a
 * real git repo.
 */
export function parseChangedLinesFromDiff(
  diff: string,
): Map<string, Set<number>> {
  const changed = new Map<string, Set<number>>()

  let currentFile: string | null = null
  let nextLine = 0

  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      const path = line.slice(4).trim()
      currentFile = path === '/dev/null' ? null : path.replace(/^b\//, '')
      continue
    }
    if (line.startsWith('@@')) {
      const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
      if (match) nextLine = Number(match[1])
      continue
    }
    if (currentFile && isTrackedTsFile(currentFile)) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        if (!changed.has(currentFile)) changed.set(currentFile, new Set())
        changed.get(currentFile)!.add(nextLine)
        nextLine++
      } else if (!line.startsWith('-')) {
        nextLine++
      }
    }
  }

  return changed
}

/** Maps each changed file to the set of line numbers added/modified in the diff (new-file line numbers). */
function getChangedLines(baseRef: string): Map<string, Set<number>> {
  // Widened to the whole src/ tree and filtered in JS via isTrackedTsFile()
  // below — git's default pathspec matching treats `**` as two directory-
  // bound `*`s (not a true globstar) without `:(glob)` magic, so
  // `src/**/*.ts` silently misses files directly under src/ with no
  // subdirectory.
  const diff = git(['diff', '--unified=0', `${baseRef}...HEAD`, '--', 'src/'])
  return parseChangedLinesFromDiff(diff)
}

/**
 * Parses lcov content into a map of file → per-line hit counts. Pure
 * function of the file content, split out of `parseLcov()` so it's testable
 * without a real lcov.info on disk.
 */
export function parseLcovContent(
  content: string,
): Map<string, Map<number, number>> {
  const perFile = new Map<string, Map<number, number>>()
  let currentFile: string | null = null

  for (const line of content.split('\n')) {
    if (line.startsWith('SF:')) {
      currentFile = line.slice(3).trim()
      perFile.set(currentFile, new Map())
    } else if (line.startsWith('DA:') && currentFile) {
      const [lineNoStr, hitsStr] = line.slice(3).split(',')
      perFile.get(currentFile)!.set(Number(lineNoStr), Number(hitsStr))
    }
  }

  return perFile
}

/** Maps each file to its per-line hit counts, as reported by the v8/istanbul lcov output. */
function parseLcov(path: string): Map<string, Map<number, number>> {
  return parseLcovContent(readFileSync(path, 'utf8'))
}

export interface FileCoverageReport {
  file: string
  covered: number
  total: number
}

export interface DiffCoverageResult {
  totalCovered: number
  totalInstrumented: number
  fileReports: FileCoverageReport[]
}

/**
 * Cross-references changed lines against lcov hit counts to compute diff
 * coverage. Pure function of its inputs, split out of `main()` so the
 * coverage math (and its edge cases — files/lines absent from lcov) is
 * testable without real git/lcov I/O.
 */
export function computeDiffCoverage(
  changedLines: Map<string, Set<number>>,
  lcov: Map<string, Map<number, number>>,
): DiffCoverageResult {
  let totalCovered = 0
  let totalInstrumented = 0
  const fileReports: FileCoverageReport[] = []

  for (const [file, lines] of changedLines) {
    const fileCoverage = lcov.get(file)
    if (!fileCoverage) continue // file has no instrumented lines at all (e.g. a type-only file)

    let covered = 0
    let total = 0
    for (const lineNo of lines) {
      const hits = fileCoverage.get(lineNo)
      if (hits === undefined) continue // non-executable line (blank, comment, type-only, brace, etc.)
      total++
      if (hits > 0) covered++
    }

    if (total > 0) {
      fileReports.push({ file, covered, total })
      totalCovered += covered
      totalInstrumented += total
    }
  }

  return { totalCovered, totalInstrumented, fileReports }
}

function main() {
  if (!existsSync(LCOV_PATH)) {
    console.error(
      `${LCOV_PATH} not found — run \`pnpm run test:coverage\` first.`,
    )
    process.exit(1)
  }

  const baseRef = resolveBaseRef()
  if (!baseRef) {
    console.warn(
      'Could not resolve a base ref (origin/main) to diff against — skipping diff coverage check.',
    )
    return
  }

  const changedLines = getChangedLines(baseRef)
  const lcov = parseLcov(LCOV_PATH)
  const { totalCovered, totalInstrumented, fileReports } = computeDiffCoverage(
    changedLines,
    lcov,
  )

  if (totalInstrumented === 0) {
    console.log(
      'No instrumented lines changed in this diff — nothing to check.',
    )
    return
  }

  const pct = (totalCovered / totalInstrumented) * 100

  console.log(`Diff coverage (base: ${baseRef}):`)
  for (const { file, covered, total } of fileReports.sort((a, b) =>
    a.file.localeCompare(b.file),
  )) {
    const filePct = ((covered / total) * 100).toFixed(1)
    console.log(`  ${file}: ${covered}/${total} (${filePct}%)`)
  }
  console.log(
    `  TOTAL: ${totalCovered}/${totalInstrumented} (${pct.toFixed(1)}%)`,
  )

  if (pct < DIFF_THRESHOLD) {
    console.error(
      `\nDiff coverage ${pct.toFixed(1)}% is below the ${DIFF_THRESHOLD}% threshold for new/changed code.`,
    )
    process.exit(1)
  }

  console.log(`\nDiff coverage meets the ${DIFF_THRESHOLD}% threshold.`)
}

// Only run when executed directly (`tsx check-diff-coverage.ts`), not when
// imported — e.g. by tests importing the exported pure functions above.
const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(process.argv[1], 'file://').href

if (isMainModule) {
  main()
}
