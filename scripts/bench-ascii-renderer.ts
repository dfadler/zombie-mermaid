/**
 * Isolated performance benchmark for `@zombie-mermaid/ascii-renderer`.
 *
 * One of four per-package benchmarks added to attribute a regression to a
 * specific package instead of just "render got slower" (see bench-core.ts's
 * header for the full rationale; part of #875, split from #869).
 *
 * `renderMermaidASCII` is already a self-contained entry point: it does its
 * own flowchart/state parsing internally and only reaches into
 * `@zombie-mermaid/core` and `@zombie-mermaid/mermaid-parser` for the other
 * diagram types — it never touches `@zombie-mermaid/svg-renderer` or
 * `elkjs` (see packages/ascii-renderer/src/index.ts's header). Timing it
 * directly, the same way bench.ts's ASCII half already does, is therefore
 * already isolated from the SVG rendering pipeline — no setup/measurement
 * split is needed the way bench-mermaid-parser.ts/bench-svg-renderer.ts
 * need one.
 *
 * Usage: tsx scripts/bench-ascii-renderer.ts [--json=<path>]
 *   --json   Also write a machine-readable summary to this path — see
 *            bench-core.ts's header for the PackageBenchSummary shape.
 */

import { writeFile } from 'node:fs/promises'
import { samples } from '../site-src/samples-data.ts'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

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

// Warm up, untimed — see bench.ts's warm-up loop header for why (amortizes
// one-time process-level costs like V8 lazily initializing a code path on
// first use).
for (const sample of samples) {
  try {
    renderMermaidASCII(sample.source)
  } catch {
    // Non-fatal: some samples are expected to be unsupported by ASCII
    // (e.g. certain flowchart shapes) — reported properly below.
  }
}

const results: Result[] = []

console.log(
  `\n@zombie-mermaid/ascii-renderer — Benchmark (${samples.length} samples)`,
)
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
    renderMermaidASCII(sample.source)
    ms = performance.now() - t0
  } catch (err) {
    error = String(err)
    ms = -1
  }

  results.push({ index: i, title: sample.title, category, ms, error })

  console.log(
    `${col(String(i + 1), 4, 'right')}  ${col(sample.title, 38)}  ${col(category, 15)}  ${col(ms >= 0 ? fmtMs(ms) : 'N/A', 10, 'right')}`,
  )
}

console.log('═'.repeat(70))

const times = results.filter((r) => r.ms >= 0).map((r) => r.ms)
const total = times.reduce((a, b) => a + b, 0)
console.log(`Total: ${fmtMs(total)}ms across ${times.length} supported samples`)
if (times.length > 0) {
  console.log(`Average: ${fmtMs(total / times.length)}ms per sample`)
}

const unsupported = results.filter((r) => r.error)
if (unsupported.length > 0) {
  console.log(`\nUnsupported (${unsupported.length}):`)
  for (const r of unsupported) {
    console.log(`  #${r.index + 1} ${r.title}`)
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
    package: '@zombie-mermaid/ascii-renderer',
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
