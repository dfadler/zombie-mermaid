/**
 * Isolated performance benchmark for `@zombie-mermaid/svg-renderer`.
 *
 * One of four per-package benchmarks added to attribute a regression to a
 * specific package instead of just "render got slower" (see bench-core.ts's
 * header for the full rationale; part of #875, split from #869).
 *
 * `svg-renderer` owns layout + SVG emission for every diagram type —
 * including flowchart/state, via `layoutGraphSync`/`renderSvg` — see
 * src/diagram-registry.ts, which every type (flowchart included) is
 * registered in. Producing the *input* to layout/render still requires a
 * parsed diagram, which for flowchart/state comes from this repo's own
 * `src/parser.ts` (`parseMermaid`, out of scope — see #876) and for
 * class/ER/sequence/xychart comes from `@zombie-mermaid/mermaid-parser`
 * (already covered by bench-mermaid-parser.ts). That parse step runs
 * untimed here, exactly like bench-mermaid-parser.ts keeps
 * `splitStatements` untimed — only `layoutForSvg` + `renderSvg`, which is
 * svg-renderer's own code (the ELK-backed layout engine and every per-type
 * renderer), is measured.
 *
 * Reaches into `../src/diagram-registry.ts` (not a published package, but a
 * root-level module of this same repo, same as bench.ts already reaching
 * into `./src/index.ts`) for the `{ parse, layoutForSvg, renderSvg }` table
 * every diagram type is registered under — this is the same dispatch
 * `renderMermaidSVG` uses internally, so the isolated timing here reflects
 * the real per-type code path, not a hand-rolled approximation of it.
 * `buildColors`/`resolveSvgEmit` are reproduced inline below (deliberately
 * duplicated, not imported) since both are private to `src/index.ts`, which
 * this script does not otherwise need.
 *
 * Usage: tsx scripts/bench-svg-renderer.ts [--json=<path>]
 *   --json   Also write a machine-readable summary to this path — see
 *            bench-core.ts's header for the PackageBenchSummary shape.
 */

import { writeFile } from 'node:fs/promises'
import { decodeXML } from 'entities'
import { samples } from '../site-src/samples-data.ts'
import type { Sample } from '../site-src/samples-data.ts'
import {
  DEFAULTS,
  splitStatements,
  detectDiagramType,
  isMonospaceFont,
  setMonospaceMetrics,
} from '@zombie-mermaid/core'
import type {
  RenderOptions,
  DiagramColors,
  SvgEmitOptions,
  DiagramType,
} from '@zombie-mermaid/core'
import { resolveFontSizes } from '@zombie-mermaid/svg-renderer'
import { diagramRegistry } from '../src/diagram-registry.ts'
import type { SvgRenderContext } from '../src/diagram-registry.ts'

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

/** Mirrors the private `buildColors` in src/index.ts — see this file's header. */
function buildColors(options: RenderOptions): DiagramColors {
  return {
    bg: options.bg ?? DEFAULTS.bg,
    fg: options.fg ?? DEFAULTS.fg,
    line: options.line,
    accent: options.accent,
    muted: options.muted,
    surface: options.surface,
    border: options.border,
  }
}

/** Mirrors the private `resolveSvgEmit` in src/index.ts — see this file's header. */
function resolveSvgEmit(options: RenderOptions): SvgEmitOptions {
  return {
    nonce: options.nonce,
    styleAttribute: options.styleAttribute,
  }
}

/**
 * Everything needed to call `layoutForSvg`/`renderSvg` for one sample,
 * built once outside the timed loop (mirrors bench-mermaid-parser.ts's
 * setup/measure split).
 */
interface PreparedSample {
  sample: Sample
  index: number
  diagramType: DiagramType
  diagram: unknown
  options: RenderOptions
  ctx: SvgRenderContext
}

function prepare(sample: Sample, index: number): PreparedSample {
  const options: RenderOptions = sample.options ?? {}
  const decoded = decodeXML(sample.source)
  setMonospaceMetrics(isMonospaceFont(options.font ?? 'Inter'))
  const diagramType = detectDiagramType(decoded)
  const lines = splitStatements(decoded)
  const registered = diagramRegistry[diagramType]
  const diagram = registered.parse(lines, decoded)
  const ctx: SvgRenderContext = {
    colors: buildColors(options),
    font: options.font ?? 'Inter',
    transparent: options.transparent ?? false,
    fontSizes: resolveFontSizes(options.fontSizes),
    embedSource: options.embedSource ? sample.source : undefined,
    title: options.title,
    decorative: options.decorative,
    emit: resolveSvgEmit(options),
  }
  return { sample, index, diagramType, diagram, options, ctx }
}

function renderTimed(prepared: PreparedSample): number {
  const registered = diagramRegistry[prepared.diagramType]
  const t0 = performance.now()
  const positioned = registered.layoutForSvg(prepared.diagram, prepared.options)
  registered.renderSvg(positioned, prepared.ctx, prepared.options)
  return performance.now() - t0
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

const prepared: PreparedSample[] = []
const prepFailures: { index: number; title: string; error: string }[] = []
for (let i = 0; i < samples.length; i++) {
  const sample = samples[i]!
  try {
    prepared.push(prepare(sample, i))
  } catch (err) {
    prepFailures.push({ index: i, title: sample.title, error: String(err) })
  }
}

// Warm up, untimed — see bench.ts's warm-up loop header for why.
for (const p of prepared) {
  try {
    renderTimed(p)
  } catch {
    // Non-fatal warm-up failure — reported properly by the timed run below.
  }
}

const results: Result[] = []

console.log(
  `\n@zombie-mermaid/svg-renderer — Benchmark (${prepared.length} of ${samples.length} samples)`,
)
console.log('═'.repeat(70))
console.log(
  `${col('#', 4, 'right')}  ${col('Title', 38)}  ${col('Category', 15)}  ${col('Time (ms)', 10, 'right')}`,
)
console.log('─'.repeat(70))

for (const p of prepared) {
  const category = p.sample.category ?? 'Other'
  let ms = 0
  let error: string | null = null

  try {
    ms = renderTimed(p)
  } catch (err) {
    error = String(err)
    ms = -1
  }

  results.push({ index: p.index, title: p.sample.title, category, ms, error })

  console.log(
    `${col(String(p.index + 1), 4, 'right')}  ${col(p.sample.title, 38)}  ${col(category, 15)}  ${col(ms >= 0 ? fmtMs(ms) : 'ERR', 10, 'right')}`,
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
if (errors.length > 0 || prepFailures.length > 0) {
  console.log(`\nErrors (${errors.length + prepFailures.length}):`)
  for (const r of errors) {
    console.log(`  #${r.index + 1} ${r.title}: ${r.error}`)
  }
  for (const f of prepFailures) {
    console.log(`  #${f.index + 1} ${f.title} (setup): ${f.error}`)
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
    package: '@zombie-mermaid/svg-renderer',
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
