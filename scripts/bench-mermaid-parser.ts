/**
 * Isolated performance benchmark for `@zombie-mermaid/mermaid-parser`.
 *
 * One of four per-package benchmarks added to attribute a regression to a
 * specific package instead of just "render got slower" (see bench-core.ts's
 * header for the full rationale; part of #875, split from #869).
 *
 * `mermaid-parser` owns the per-type parsers for class, ER, sequence, and
 * XY chart diagrams (`parseClassDiagram`/`parseErDiagram`/
 * `parseSequenceDiagram`/`parseXYChart` — see that package's src/index.ts
 * header). Flowchart/state diagrams are parsed by this repo's own
 * `src/parser.ts` (`parseMermaid`), not by this package — deliberately out
 * of scope here (and for #876, which covers parser-only timing at a finer
 * grain than package level; see #875's issue body). Every sample that isn't
 * class/ER/sequence/xychart is skipped and reported as such rather than
 * silently dropped.
 *
 * `@zombie-mermaid/core`'s `splitStatements` is used only to build each
 * parser's `Statement[]` input — that step is core's own code, already
 * covered by bench-core.ts, so it runs untimed here (mirroring bench.ts's
 * own warm-up-before-measuring pattern of separating setup from the
 * measured operation).
 *
 * Usage: tsx scripts/bench-mermaid-parser.ts [--json=<path>]
 *   --json   Also write a machine-readable summary to this path — see
 *            bench-core.ts's header for the PackageBenchSummary shape.
 */

import { writeFile } from 'node:fs/promises'
import { samples } from '../samples-data.ts'
import { splitStatements, detectDiagramType } from '@zombie-mermaid/core'
import type { DiagramType, Statement } from '@zombie-mermaid/core'
import {
  parseClassDiagram,
  parseErDiagram,
  parseSequenceDiagram,
  parseXYChart,
} from '@zombie-mermaid/mermaid-parser'

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

/** The diagram types `@zombie-mermaid/mermaid-parser` owns parsing for. */
const SUPPORTED: ReadonlySet<DiagramType> = new Set([
  'class',
  'er',
  'sequence',
  'xychart',
])

function parseFor(type: DiagramType, lines: Statement[]): unknown {
  switch (type) {
    case 'class':
      return parseClassDiagram(lines)
    case 'er':
      return parseErDiagram(lines)
    case 'sequence':
      return parseSequenceDiagram(lines)
    case 'xychart':
      return parseXYChart(lines)
    case 'flowchart':
      throw new Error('flowchart is not owned by mermaid-parser')
  }
}

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

const applicable = samples
  .map((sample, index) => ({
    sample,
    index,
    type: detectDiagramType(sample.source),
  }))
  .filter((s) => SUPPORTED.has(s.type))
const skippedCount = samples.length - applicable.length

// Warm up, untimed — see bench-core.ts's header for why.
for (const { sample, type } of applicable) {
  try {
    const lines = splitStatements(sample.source)
    parseFor(type, lines)
  } catch {
    // Non-fatal warm-up failure — reported properly by the timed run below.
  }
}

const results: Result[] = []

console.log(
  `\n@zombie-mermaid/mermaid-parser — Benchmark (${applicable.length} of ${samples.length} samples; ${skippedCount} skipped — flowchart/state is parsed outside this package)`,
)
console.log('═'.repeat(70))
console.log(
  `${col('#', 4, 'right')}  ${col('Title', 38)}  ${col('Category', 15)}  ${col('Time (ms)', 10, 'right')}`,
)
console.log('─'.repeat(70))

for (const { sample, index, type } of applicable) {
  const category = sample.category ?? 'Other'
  let ms = 0
  let error: string | null = null

  // Build this parser's input outside the timed region — splitStatements is
  // core's own code (see bench-core.ts), not mermaid-parser's.
  let lines: Statement[]
  try {
    lines = splitStatements(sample.source)
  } catch (err) {
    results.push({
      index,
      title: sample.title,
      category,
      ms: -1,
      error: String(err),
    })
    console.log(
      `${col(String(index + 1), 4, 'right')}  ${col(sample.title, 38)}  ${col(category, 15)}  ${col('ERR', 10, 'right')}`,
    )
    continue
  }

  try {
    const t0 = performance.now()
    parseFor(type, lines)
    ms = performance.now() - t0
  } catch (err) {
    error = String(err)
    ms = -1
  }

  results.push({ index, title: sample.title, category, ms, error })

  console.log(
    `${col(String(index + 1), 4, 'right')}  ${col(sample.title, 38)}  ${col(category, 15)}  ${col(ms >= 0 ? fmtMs(ms) : 'ERR', 10, 'right')}`,
  )
}

console.log('═'.repeat(70))

const times = results.filter((r) => r.ms >= 0).map((r) => r.ms)
const total = times.reduce((a, b) => a + b, 0)
console.log(`Total: ${fmtMs(total)}ms across ${results.length} samples`)
if (results.length > 0) {
  console.log(`Average: ${fmtMs(total / results.length)}ms per sample`)
}

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
    package: '@zombie-mermaid/mermaid-parser',
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
