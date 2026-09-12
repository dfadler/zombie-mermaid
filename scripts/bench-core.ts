/**
 * Isolated performance benchmark for `@zombie-mermaid/core`.
 *
 * `bench.ts` only measures full end-to-end render time (SVG + ASCII), so a
 * regression anywhere in the pipeline shows up as just "render got slower" —
 * this is one of four per-package benchmarks (see also bench-mermaid-parser.ts,
 * bench-svg-renderer.ts, bench-ascii-renderer.ts) added so a regression can be
 * attributed to a specific package instead. Part of #875 (split from #869).
 *
 * `core` has no rendering pipeline of its own — it is the shared
 * preprocessing/utility layer every renderer (SVG, ASCII) calls into before
 * doing its own work. The two functions timed here, `splitStatements` and
 * `detectDiagramType`, are the ones every single render pays for regardless
 * of diagram type or output format (see packages/core/src/statements.ts and
 * packages/core/src/diagram-type.ts) — an isolated core benchmark times
 * exactly that shared cost, in isolation from mermaid-parser/svg-renderer/
 * ascii-renderer.
 *
 * Usage: tsx scripts/bench-core.ts [--json=<path>]
 *   --json   Also write a machine-readable summary to this path. See the
 *            PackageBenchSummary shape below — modeled on bench.ts's own
 *            `--json=` contract (generatedAt/sampleCount/categories), but
 *            with a single `totalMs` metric per category instead of that
 *            script's svgMs/asciiMs split: this package does one kind of
 *            work, not two. Consumed by scripts/bench-package-compare.ts.
 */

import { writeFile } from 'node:fs/promises'
import { samples } from '../site-src/samples-data.ts'
import { splitStatements, detectDiagramType } from '@zombie-mermaid/core'

const jsonArg = process.argv.find((a) => a.startsWith('--json='))
const JSON_OUTPUT_PATH = jsonArg ? jsonArg.slice('--json='.length) : null

// ============================================================================
// Types
// ============================================================================

interface Result {
  index: number
  title: string
  category: string
  ms: number
  error: string | null
}

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

// ============================================================================
// Helpers
// ============================================================================

function col(
  value: string,
  width: number,
  align: 'left' | 'right' = 'left',
): string {
  const truncated =
    value.length > width ? value.slice(0, width - 1) + '…' : value
  return align === 'right' ? truncated.padStart(width) : truncated.padEnd(width)
}

function fmtMs(ms: number): string {
  return ms.toFixed(3)
}

// ============================================================================
// Main
// ============================================================================

// Warm up once, untimed, before measuring — see bench.ts's own warm-up loop
// header for why (amortizing one-time process-level costs like V8 lazily
// initializing a code path on first use, so it isn't misattributed entirely
// to whichever sample happens to hit it first).
for (const sample of samples) {
  try {
    splitStatements(sample.source)
    detectDiagramType(sample.source)
  } catch {
    // Non-fatal warm-up failure — reported properly by the timed run below.
  }
}

const results: Result[] = []

console.log(`\n@zombie-mermaid/core — Benchmark (${samples.length} samples)`)
console.log('═'.repeat(70))
console.log(
  `${col('#', 4, 'right')}  ${col('Title', 38)}  ${col('Category', 15)}  ${col('Time (ms)', 10, 'right')}`,
)
console.log('─'.repeat(70))

for (let i = 0; i < samples.length; i++) {
  const sample = samples[i]!
  const category = sample.category ?? 'Other'
  let ms = 0
  let error: string | null = null

  try {
    const t0 = performance.now()
    splitStatements(sample.source)
    detectDiagramType(sample.source)
    ms = performance.now() - t0
  } catch (err) {
    error = String(err)
    ms = -1
  }

  results.push({ index: i, title: sample.title, category, ms, error })

  console.log(
    `${col(String(i + 1), 4, 'right')}  ${col(sample.title, 38)}  ${col(category, 15)}  ${col(ms >= 0 ? fmtMs(ms) : 'ERR', 10, 'right')}`,
  )
}

console.log('═'.repeat(70))

const times = results.filter((r) => r.ms >= 0).map((r) => r.ms)
const total = times.reduce((a, b) => a + b, 0)
console.log(`Total: ${fmtMs(total)}ms across ${results.length} samples`)
console.log(`Average: ${fmtMs(total / results.length)}ms per sample`)

const errors = results.filter((r) => r.error)
if (errors.length > 0) {
  console.log(`\nErrors (${errors.length}):`)
  for (const r of errors) {
    console.log(`  #${r.index + 1} ${r.title}: ${r.error}`)
  }
}

console.log('\n── By Category ──')
const catMap = new Map<string, Result[]>()
for (const r of results) {
  if (!catMap.has(r.category)) catMap.set(r.category, [])
  catMap.get(r.category)!.push(r)
}
for (const [cat, catResults] of catMap) {
  const catTotal = catResults
    .filter((r) => r.ms >= 0)
    .reduce((a, r) => a + r.ms, 0)
  console.log(
    `  ${col(cat, 16)} ${col(String(catResults.length), 3, 'right')} samples  Total: ${col(fmtMs(catTotal), 8, 'right')}ms`,
  )
}

console.log()

if (JSON_OUTPUT_PATH) {
  const categories: Record<string, PackageBenchCategorySummary> = {}
  for (const [cat, catResults] of catMap) {
    categories[cat] = {
      sampleCount: catResults.length,
      totalMs: catResults
        .filter((r) => r.ms >= 0)
        .reduce((a, r) => a + r.ms, 0),
    }
  }

  const summary: PackageBenchSummary = {
    generatedAt: new Date().toISOString(),
    package: '@zombie-mermaid/core',
    sampleCount: results.length,
    totalMs: total,
    categories,
  }

  await writeFile(
    JSON_OUTPUT_PATH,
    JSON.stringify(summary, null, 2) + '\n',
    'utf-8',
  )
  console.log(`JSON summary written to ${JSON_OUTPUT_PATH}`)
}
