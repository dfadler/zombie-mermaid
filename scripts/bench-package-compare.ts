/**
 * Compares one per-package benchmark's JSON summary (bench-core.ts,
 * bench-mermaid-parser.ts, bench-svg-renderer.ts, or bench-ascii-renderer.ts
 * — see any of their headers for the shared `PackageBenchSummary` shape)
 * against a stored baseline and fails if `totalMs` regressed beyond a
 * threshold. This is the per-package analog of scripts/bench-compare.ts,
 * generalized to the single-metric shape those scripts write instead of
 * bench.ts's svgMs/asciiMs split — added for #875 (split from #869).
 *
 * Usage: tsx scripts/bench-package-compare.ts <current.json> --baseline=<path> [--threshold=<pct>]
 *   --baseline   Path to the baseline summary. Required (unlike
 *                bench-compare.ts's single default) — there are four
 *                per-package baselines, one per package, so the caller must
 *                say which one applies.
 *   --threshold  Allowed regression, as a percent of the baseline's
 *                totalMs. Defaults to 75 — same deliberately loose value
 *                and same reasoning as bench-compare.ts: shared
 *                GitHub-hosted runners are noisy enough that a tight
 *                threshold would flag CI variance, not real regressions.
 *                The goal is catching an accidental algorithmic blowup in
 *                one specific package, not micro-tuning it.
 *
 * IMPORTANT: like bench-baseline.json (see scripts/bench-compare.ts's own
 * header for the incident this refers to), a per-package baseline must only
 * ever be generated on a GitHub Actions runner, never on a local machine —
 * mixing a faster local measurement into a CI-only baseline reads as a fake
 * regression on the first real CI run. If a package's baseline file doesn't
 * exist yet, this script prints a friendly message and exits 0 rather than
 * failing CI on a baseline nobody has authored yet — see the `bench-history`
 * job precedent in .github/workflows/ci.yml (added for #874) for the same
 * "nothing to compare against yet" tolerance in a sibling script
 * (scripts/bench-trend.ts).
 */

import { readFile } from 'node:fs/promises'

interface PackageBenchCategorySummary {
  sampleCount: number
  totalMs: number
}

interface PackageBenchSummary {
  generatedAt: string
  package: string
  sampleCount: number
  totalMs: number
  categories: Record<string, PackageBenchCategorySummary>
}

// `pnpm run <script> -- <args>` forwards the literal `--` separator into this
// script's argv (unlike `npm run`, which strips it) — filter it out so both
// invocation styles behave identically, same as scripts/bench-compare.ts.
const scriptArgs = process.argv.slice(2).filter((a) => a !== '--')

function argValue(flag: string): string | null {
  const arg = scriptArgs.find((a) => a.startsWith(flag))
  return arg ? arg.slice(flag.length) : null
}

const currentPath = scriptArgs.find((a) => !a.startsWith('--'))
const baselinePath = argValue('--baseline=')
const thresholdPct = Number(argValue('--threshold=') ?? '75')

if (!currentPath || !baselinePath) {
  console.error(
    'Usage: tsx scripts/bench-package-compare.ts <current.json> --baseline=<path> [--threshold=<pct>]',
  )
  process.exit(2)
}

function fmtMs(ms: number): string {
  return ms.toFixed(3)
}

function fmtPct(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

async function readSummary(path: string): Promise<PackageBenchSummary | null> {
  let raw: string
  try {
    raw = await readFile(path, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
  return JSON.parse(raw) as PackageBenchSummary
}

const current = await readSummary(currentPath)
if (!current) {
  console.error(`FAIL: current summary not found at ${currentPath}.`)
  process.exit(1)
}

const baseline = await readSummary(baselinePath)
if (!baseline) {
  console.log(
    `No baseline yet at ${baselinePath} for ${current.package} — nothing to ` +
      'compare against. Skipping the gate for this package until a maintainer ' +
      "seeds a baseline from a real CI run (see this file's header comment " +
      'for why it must come from CI, not a local machine, same as ' +
      'bench-baseline.json).',
  )
  process.exit(0)
}

const deltaPct =
  baseline.totalMs > 0
    ? ((current.totalMs - baseline.totalMs) / baseline.totalMs) * 100
    : 0

console.log(`Benchmark comparison for ${current.package} vs ${baselinePath}`)
console.log('─'.repeat(60))
console.log(
  `Baseline: ${fmtMs(baseline.totalMs)}ms (${baseline.sampleCount} samples, ${baseline.generatedAt})`,
)
console.log(
  `Current:  ${fmtMs(current.totalMs)}ms (${current.sampleCount} samples, ${current.generatedAt})`,
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
  const bTotal = b?.totalMs ?? 0
  const cTotal = c?.totalMs ?? 0
  const catDelta = bTotal > 0 ? ((cTotal - bTotal) / bTotal) * 100 : 0
  console.log(
    `  ${cat.padEnd(16)} baseline: ${fmtMs(bTotal).padStart(8)}ms  current: ${fmtMs(cTotal).padStart(8)}ms  ${fmtPct(catDelta)}`,
  )
}

if (deltaPct > thresholdPct) {
  console.error(
    `\nFAIL: ${current.package}'s total regressed ${fmtPct(deltaPct)}, exceeding the +${thresholdPct}% threshold.`,
  )
  console.error(
    'If this regression is expected (e.g. a deliberate feature trade-off), refresh this ' +
      "package's baseline from a CI run, not a local machine — see the header comment in " +
      'this file for why.',
  )
  process.exit(1)
}

console.log('\nOK: within threshold.')
