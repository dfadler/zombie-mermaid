/**
 * Compares a bench.ts JSON summary against the stored baseline
 * (bench-baseline.json) and fails if the combined render total regressed
 * beyond a threshold.
 *
 * Usage: tsx scripts/bench-compare.ts <current.json> [--baseline=<path>] [--threshold=<pct>]
 *   --baseline   Path to the baseline summary. Defaults to bench-baseline.json.
 *   --threshold  Allowed regression, as a percent of the baseline's combined
 *                total (SVG + ASCII). Defaults to 75 — deliberately loose:
 *                shared GitHub-hosted runners are noisy enough that a tight
 *                threshold would flag CI variance, not real regressions. The
 *                goal is catching an accidental O(n^2), not micro-tuning.
 *
 * IMPORTANT: bench-baseline.json must be generated on a GitHub Actions
 * runner, never on a local machine — a dev laptop measured roughly 2-2.5x
 * faster than the shared ubuntu-latest runner across every category here,
 * uniformly enough that a locally-generated baseline made every single
 * category look like a regression on the very first real CI run (see the
 * git history of bench-baseline.json for that incident). To refresh the
 * baseline after an intentional perf change: push a commit, let the `bench`
 * CI job run, download its `bench-result` artifact (`gh run download <run-id>
 * --name bench-result`), and commit that file as the new bench-baseline.json.
 */

import { readFile } from 'node:fs/promises'

interface BenchCategorySummary {
  sampleCount: number
  svgMs: number
  asciiMs: number
}

interface BenchSummary {
  generatedAt: string
  sampleCount: number
  svgTotalMs: number
  asciiTotalMs: number
  categories: Record<string, BenchCategorySummary>
}

// `pnpm run <script> -- <args>` forwards the literal `--` separator into this
// script's argv (unlike `npm run`, which strips it) — filter it out so
// `pnpm run bench:compare -- bench-current.json` and
// `pnpm run bench:compare bench-current.json` behave identically regardless
// of which convention the caller reaches for.
const scriptArgs = process.argv.slice(2).filter((a) => a !== '--')

function argValue(flag: string): string | null {
  const arg = scriptArgs.find((a) => a.startsWith(flag))
  return arg ? arg.slice(flag.length) : null
}

const currentPath = scriptArgs.find((a) => !a.startsWith('--'))
if (!currentPath) {
  console.error(
    'Usage: tsx scripts/bench-compare.ts <current.json> [--baseline=<path>] [--threshold=<pct>]',
  )
  process.exit(2)
}

const baselinePath = argValue('--baseline=') ?? 'bench-baseline.json'
const thresholdPct = Number(argValue('--threshold=') ?? '75')

async function readSummary(path: string): Promise<BenchSummary> {
  const raw = await readFile(path, 'utf-8')
  return JSON.parse(raw) as BenchSummary
}

function fmtMs(ms: number): string {
  return ms.toFixed(1)
}

function fmtPct(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

const [baseline, current] = await Promise.all([
  readSummary(baselinePath),
  readSummary(currentPath),
])

const baselineTotal = baseline.svgTotalMs + baseline.asciiTotalMs
const currentTotal = current.svgTotalMs + current.asciiTotalMs
const deltaPct =
  baselineTotal > 0 ? ((currentTotal - baselineTotal) / baselineTotal) * 100 : 0

console.log('Benchmark comparison vs bench-baseline.json')
console.log('─'.repeat(60))
console.log(
  `Baseline: ${fmtMs(baselineTotal)}ms (${baseline.sampleCount} samples, ${baseline.generatedAt})`,
)
console.log(
  `Current:  ${fmtMs(currentTotal)}ms (${current.sampleCount} samples, ${current.generatedAt})`,
)
console.log(`Delta:    ${fmtPct(deltaPct)} (threshold: +${thresholdPct}%)`)

console.log('\nBy category:')
const allCategories = new Set([
  ...Object.keys(baseline.categories),
  ...Object.keys(current.categories),
])
for (const cat of allCategories) {
  const b = baseline.categories[cat]
  const c = current.categories[cat]
  const bTotal = b ? b.svgMs + b.asciiMs : 0
  const cTotal = c ? c.svgMs + c.asciiMs : 0
  const catDelta = bTotal > 0 ? ((cTotal - bTotal) / bTotal) * 100 : 0
  console.log(
    `  ${cat.padEnd(16)} baseline: ${fmtMs(bTotal).padStart(8)}ms  current: ${fmtMs(cTotal).padStart(8)}ms  ${fmtPct(catDelta)}`,
  )
}

if (deltaPct > thresholdPct) {
  console.error(
    `\nFAIL: combined render total regressed ${fmtPct(deltaPct)}, exceeding the +${thresholdPct}% threshold.`,
  )
  console.error(
    'If this regression is expected (e.g. a deliberate feature trade-off), refresh the baseline ' +
      'from a CI run, not a local machine — see the header comment in this file for why.',
  )
  process.exit(1)
}

console.log('\nOK: within threshold.')
