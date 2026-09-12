/**
 * Performance benchmark for beautiful-mermaid.
 *
 * Runs all sample definitions through both renderers (SVG + ASCII)
 * and prints a table with per-sample timing and aggregate stats.
 *
 * Also times the *parse phase alone* (`parseMs`), isolated from layout and
 * rendering, for the SVG pipeline: `svgMs` already includes parse time as
 * part of the full parse+layout+render pipeline, so a parser-only
 * regression can get masked or diluted by layout/renderer variance in that
 * combined number (issue #876). `parseMs` re-runs just the diagram-type
 * detection + parse step that `src/diagram-registry.ts`'s `parse` field
 * performs for every registered type — `parseClassDiagram`,
 * `parseErDiagram`, `parseSequenceDiagram`, `parseXYChart` from
 * `@zombie-mermaid/mermaid-parser` for those four diagram types, and the
 * local `parseMermaid` (src/parser.ts) for flowchart/state — using the
 * exact same registry lookup the real render uses, so the measured code
 * path matches production exactly rather than reimplementing parsing logic
 * here. This is finer-grained than #875's per-package benchmarking: that
 * isolates `mermaid-parser`'s own benchmarks from other packages'; this
 * isolates the parse *phase* from layout/render *within* one sample's
 * render pipeline. ASCII parsing isn't split out separately: each ASCII
 * renderer re-parses from raw text internally with no equivalent
 * `{ parse, layout, render }` seam to hook (see diagram-registry.ts's
 * header comment on why the ASCII side has no shared `parse` step).
 *
 * Usage: tsx scripts/bench.ts [--json=<path>]
 *   --json   Also write a machine-readable summary (totals + per-category
 *            breakdown, including parseTotalMs/parseMs) to this path.
 *            Consumed by scripts/bench-compare.ts to gate CI against
 *            bench-baseline.json (which only reads the pre-existing
 *            svgTotalMs/asciiTotalMs fields; the new parse fields are
 *            additive and don't affect that gate).
 */

import { writeFile } from 'node:fs/promises'
import { decodeXML } from 'entities'
import { samples } from '../samples-data.ts'
import { renderMermaid } from '../src/index.ts'
import { diagramRegistry } from '../src/diagram-registry.ts'
import { detectDiagramType, splitStatements } from '@zombie-mermaid/core'
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
  parseMs: number
  svgMs: number
  asciiMs: number
  parseError: string | null
  svgError: string | null
  asciiError: string | null
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Runs just the parse phase for `source` — diagram-type detection plus that
 * type's `parse` step — via the same `diagramRegistry` lookup
 * `renderMermaidSVGRaw` (src/index.ts) uses for the real render, so this
 * measures the identical parse code path production takes rather than a
 * benchmark-only reimplementation.
 */
function parseOnly(source: string): void {
  const decoded = decodeXML(source)
  const diagramType = detectDiagramType(decoded)
  const lines = splitStatements(decoded)
  diagramRegistry[diagramType].parse(lines, decoded)
}

/** Pad/truncate a string to exactly `width` characters, right-aligned if numeric. */
function col(
  value: string,
  width: number,
  align: 'left' | 'right' = 'left',
): string {
  const truncated =
    value.length > width ? value.slice(0, width - 1) + '\u2026' : value
  return align === 'right' ? truncated.padStart(width) : truncated.padEnd(width)
}

function fmtMs(ms: number): string {
  return ms.toFixed(1)
}

// ============================================================================
// Main
// ============================================================================

// Warm up both renderers against every category once, untimed, before
// measuring. Without this, a one-time process-level cost that only the
// first call to some code path pays (e.g. V8 lazily initializing ICU on the
// first `Intl`/`toLocaleString` call — see xychart's `formatTipValue`) gets
// attributed entirely to whichever sample happens to hit that path first,
// rather than being amortized the way it would be in a real long-running
// process. That produced a single-sample outlier (~1-1.7s on one xychart
// sample vs ~1-3ms on every other) large enough to blow the regression
// gate's threshold on its own even though nothing else regressed.
for (const sample of samples) {
  try {
    parseOnly(sample.source)
  } catch (err) {
    console.warn(`Warm-up parse failed for "${sample.title}": ${err}`)
  }
  try {
    await renderMermaid(sample.source, sample.options)
  } catch (err) {
    // Non-fatal: an expected per-sample failure (e.g. an unsupported
    // diagram type) is re-caught and reported properly by the timed run
    // below. Logged here only so an *unexpected* warm-up-only failure still
    // leaves a trace in the Actions log instead of vanishing silently.
    console.warn(`Warm-up SVG render failed for "${sample.title}": ${err}`)
  }
  try {
    renderMermaidASCII(sample.source)
  } catch (err) {
    console.warn(`Warm-up ASCII render failed for "${sample.title}": ${err}`)
  }
}

const results: Result[] = []
const totalStart = performance.now()

console.log(`\nbeautiful-mermaid — Benchmark (${samples.length} samples)`)
console.log('═'.repeat(106))
console.log(
  `${col('#', 4, 'right')}  ${col('Title', 34)}  ${col('Category', 13)}  ${col('Parse (ms)', 10, 'right')}  ${col('SVG (ms)', 10, 'right')}  ${col('ASCII (ms)', 10, 'right')}  ${col('Total', 10, 'right')}`,
)
console.log('─'.repeat(106))

for (let i = 0; i < samples.length; i++) {
  const sample = samples[i]!
  const category = sample.category ?? 'Other'
  let parseMs = 0
  let svgMs = 0
  let asciiMs = 0
  let parseError: string | null = null
  let svgError: string | null = null
  let asciiError: string | null = null

  // Parse only — isolates the parse phase from the layout/render work
  // `svgMs` below also includes. See parseOnly()'s doc comment.
  try {
    const t0 = performance.now()
    parseOnly(sample.source)
    parseMs = performance.now() - t0
  } catch (err) {
    parseError = String(err)
    parseMs = -1
  }

  // Render SVG (async — uses ELK layout for flowcharts/state/class/ER)
  try {
    const t0 = performance.now()
    await renderMermaid(sample.source, sample.options)
    svgMs = performance.now() - t0
  } catch (err) {
    svgError = String(err)
    svgMs = -1
  }

  // Render ASCII (sync — custom text layout, no ELK)
  try {
    const t0 = performance.now()
    renderMermaidASCII(sample.source)
    asciiMs = performance.now() - t0
  } catch (err) {
    asciiError = String(err)
    asciiMs = -1
  }

  const totalMs = (svgMs >= 0 ? svgMs : 0) + (asciiMs >= 0 ? asciiMs : 0)

  results.push({
    index: i,
    title: sample.title,
    category,
    parseMs,
    svgMs,
    asciiMs,
    parseError,
    svgError,
    asciiError,
  })

  // Print row
  const parseStr = parseMs >= 0 ? fmtMs(parseMs) : 'ERR'
  const svgStr = svgMs >= 0 ? fmtMs(svgMs) : 'ERR'
  const asciiStr = asciiMs >= 0 ? fmtMs(asciiMs) : 'N/A'
  console.log(
    `${col(String(i + 1), 4, 'right')}  ${col(sample.title, 34)}  ${col(category, 13)}  ${col(parseStr, 10, 'right')}  ${col(svgStr, 10, 'right')}  ${col(asciiStr, 10, 'right')}  ${col(fmtMs(totalMs), 10, 'right')}`,
  )
}

const totalElapsed = performance.now() - totalStart

// ============================================================================
// Aggregates
// ============================================================================

console.log('═'.repeat(106))

const parseTimes = results.filter((r) => r.parseMs >= 0).map((r) => r.parseMs)
const svgTimes = results.filter((r) => r.svgMs >= 0).map((r) => r.svgMs)
const asciiTimes = results.filter((r) => r.asciiMs >= 0).map((r) => r.asciiMs)
const parseTotal = parseTimes.reduce((a, b) => a + b, 0)
const svgTotal = svgTimes.reduce((a, b) => a + b, 0)
const asciiTotal = asciiTimes.reduce((a, b) => a + b, 0)

console.log(
  `Total: ${fmtMs(totalElapsed)}ms (Parse: ${fmtMs(parseTotal)}ms, SVG: ${fmtMs(svgTotal)}ms, ASCII: ${fmtMs(asciiTotal)}ms)`,
)
console.log(
  `Average: ${fmtMs((svgTotal + asciiTotal) / results.length)}ms per sample`,
)

// Find slowest parse, SVG, and ASCII
if (parseTimes.length > 0) {
  const slowestParse = results
    .filter((r) => r.parseMs >= 0)
    .sort((a, b) => b.parseMs - a.parseMs)[0]!
  console.log(
    `Slowest parse: #${slowestParse.index + 1} ${slowestParse.title} (${fmtMs(slowestParse.parseMs)}ms)`,
  )
}
if (svgTimes.length > 0) {
  const slowestSvg = results
    .filter((r) => r.svgMs >= 0)
    .sort((a, b) => b.svgMs - a.svgMs)[0]!
  console.log(
    `Slowest SVG:   #${slowestSvg.index + 1} ${slowestSvg.title} (${fmtMs(slowestSvg.svgMs)}ms)`,
  )
}
if (asciiTimes.length > 0) {
  const slowestAscii = results
    .filter((r) => r.asciiMs >= 0)
    .sort((a, b) => b.asciiMs - a.asciiMs)[0]!
  console.log(
    `Slowest ASCII: #${slowestAscii.index + 1} ${slowestAscii.title} (${fmtMs(slowestAscii.asciiMs)}ms)`,
  )
}

// Report errors
const parseErrors = results.filter((r) => r.parseError)
const svgErrors = results.filter((r) => r.svgError)
const asciiErrors = results.filter((r) => r.asciiError)
if (parseErrors.length > 0) {
  console.log(`\nParse errors (${parseErrors.length}):`)
  for (const r of parseErrors) {
    console.log(`  #${r.index + 1} ${r.title}: ${r.parseError}`)
  }
}
if (svgErrors.length > 0) {
  console.log(`\nSVG errors (${svgErrors.length}):`)
  for (const r of svgErrors) {
    console.log(`  #${r.index + 1} ${r.title}: ${r.svgError}`)
  }
}
if (asciiErrors.length > 0) {
  console.log(`\nASCII unsupported (${asciiErrors.length}):`)
  for (const r of asciiErrors) {
    console.log(`  #${r.index + 1} ${r.title}`)
  }
}

// Category breakdown
console.log('\n── By Category ──')
const catMap = new Map<string, Result[]>()
for (const r of results) {
  if (!catMap.has(r.category)) catMap.set(r.category, [])
  catMap.get(r.category)!.push(r)
}
for (const [cat, catResults] of catMap) {
  const catParse = catResults
    .filter((r) => r.parseMs >= 0)
    .reduce((a, r) => a + r.parseMs, 0)
  const catSvg = catResults
    .filter((r) => r.svgMs >= 0)
    .reduce((a, r) => a + r.svgMs, 0)
  const catAscii = catResults
    .filter((r) => r.asciiMs >= 0)
    .reduce((a, r) => a + r.asciiMs, 0)
  console.log(
    `  ${col(cat, 16)} ${col(String(catResults.length), 3, 'right')} samples  Parse: ${col(fmtMs(catParse), 8, 'right')}ms  SVG: ${col(fmtMs(catSvg), 8, 'right')}ms  ASCII: ${col(fmtMs(catAscii), 8, 'right')}ms  Total: ${col(fmtMs(catSvg + catAscii), 8, 'right')}ms`,
  )
}

console.log()

// ============================================================================
// JSON summary (optional)
// ============================================================================

if (JSON_OUTPUT_PATH) {
  const categories: Record<
    string,
    { sampleCount: number; parseMs: number; svgMs: number; asciiMs: number }
  > = {}
  for (const [cat, catResults] of catMap) {
    categories[cat] = {
      sampleCount: catResults.length,
      parseMs: catResults
        .filter((r) => r.parseMs >= 0)
        .reduce((a, r) => a + r.parseMs, 0),
      svgMs: catResults
        .filter((r) => r.svgMs >= 0)
        .reduce((a, r) => a + r.svgMs, 0),
      asciiMs: catResults
        .filter((r) => r.asciiMs >= 0)
        .reduce((a, r) => a + r.asciiMs, 0),
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    sampleCount: results.length,
    // New in #876: parse-phase-only total, additive to the pre-existing
    // svgTotalMs/asciiTotalMs/categories fields. scripts/bench-compare.ts
    // and scripts/bench-history-append.ts only read those pre-existing
    // fields, so this addition doesn't affect the CI regression gate or
    // the history/trend tooling — it's here for anyone who wants to watch
    // parse time specifically, independent of layout/render variance.
    parseTotalMs: parseTotal,
    svgTotalMs: svgTotal,
    asciiTotalMs: asciiTotal,
    categories,
  }

  await writeFile(
    JSON_OUTPUT_PATH,
    JSON.stringify(summary, null, 2) + '\n',
    'utf-8',
  )
  console.log(`JSON summary written to ${JSON_OUTPUT_PATH}`)
}
