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
 * To refresh the baseline after an intentional perf change, run
 * `pnpm run bench -- --json=bench-baseline.json` locally and commit the
 * result.
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

function argValue(flag: string): string | null {
  const arg = process.argv.find((a) => a.startsWith(flag))
  return arg ? arg.slice(flag.length) : null
}

const currentPath = process.argv[2]
if (!currentPath || currentPath.startsWith('--')) {
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
    'If this regression is expected (e.g. a deliberate feature trade-off), refresh the baseline: ' +
      'pnpm run bench -- --json=bench-baseline.json',
  )
  process.exit(1)
}

console.log('\nOK: within threshold.')
