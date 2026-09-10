/**
 * Prints a trend report over bench-history.jsonl — how the combined render
 * total (and each category) has moved across the last N recorded runs.
 *
 * This is the "weeks/months of drift" complement to
 * scripts/bench-compare.ts's single current-vs-baseline snapshot: that
 * script answers "did this one run regress against the pinned baseline?";
 * this one answers "which way has render time been trending across the
 * runs recorded so far?". Neither replaces the other — bench-compare.ts
 * stays CI's pass/fail gate; this is a read-only report for a human
 * (`pnpm run bench:trend`), not wired into any gate.
 *
 * Usage: tsx scripts/bench-trend.ts [--history=<path>] [--window=<n>]
 *   --history  Path to the history file. Defaults to bench-history.jsonl.
 *   --window   How many of the most recent entries to report over.
 *              Defaults to 20.
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { BenchHistoryEntry } from './bench-history-append.ts'

// ============================================================================
// Pure helpers (exported for tests)
// ============================================================================

/** Parses bench-history.jsonl content into entries; empty input -> []. */
export function parseHistory(raw: string): BenchHistoryEntry[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as BenchHistoryEntry)
}

export function combinedTotal(entry: BenchHistoryEntry): number {
  return entry.svgTotalMs + entry.asciiTotalMs
}

/**
 * Renders `values` as an 8-level Unicode block sparkline, scaled between
 * the window's own min and max (not a fixed scale) — this is a shape-of-
 * the-trend view, not a precise chart.
 */
export function sparkline(values: number[]): string {
  if (values.length === 0) return ''
  const blocks = '▁▂▃▄▅▆▇█'
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  return values
    .map((v) => {
      if (range === 0) return blocks[0]
      const level = Math.round(((v - min) / range) * (blocks.length - 1))
      return blocks[level]
    })
    .join('')
}

function fmtMs(ms: number): string {
  return ms.toFixed(1)
}

function fmtPct(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function fmtDate(iso: string): string {
  return iso.slice(0, 10) // YYYY-MM-DD
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

  const historyPath = argValue('--history=') ?? 'bench-history.jsonl'
  const window = Number(argValue('--window=') ?? '20')

  let raw: string
  try {
    raw = await readFile(historyPath, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log(
        `No trend history yet at ${historyPath} — it's created by the ` +
          '`bench-history` CI job the first time it runs on a push to main. ' +
          'Nothing to report until then.',
      )
      return
    }
    throw err
  }

  const all = parseHistory(raw)
  if (all.length === 0) {
    console.log(`${historyPath} exists but has no entries yet.`)
    return
  }

  const entries = all.slice(-window)

  console.log(
    `\nbeautiful-mermaid — Benchmark trend (${entries.length} of ${all.length} recorded run(s))`,
  )
  console.log('═'.repeat(90))
  console.log(
    `${'Date'.padEnd(12)}  ${'Commit'.padEnd(9)}  ${'Total (ms)'.padStart(10)}  ${'vs prev'.padStart(9)}  ${'vs first'.padStart(9)}`,
  )
  console.log('─'.repeat(90))

  const firstTotal = combinedTotal(entries[0]!)
  entries.forEach((entry, i) => {
    const total = combinedTotal(entry)
    const prevTotal = i > 0 ? combinedTotal(entries[i - 1]!) : null
    const vsPrev =
      prevTotal !== null && prevTotal > 0
        ? fmtPct(((total - prevTotal) / prevTotal) * 100)
        : '—'
    const vsFirst =
      i > 0 && firstTotal > 0
        ? fmtPct(((total - firstTotal) / firstTotal) * 100)
        : '—'
    console.log(
      `${fmtDate(entry.generatedAt).padEnd(12)}  ${entry.commit.slice(0, 7).padEnd(9)}  ${fmtMs(total).padStart(10)}  ${vsPrev.padStart(9)}  ${vsFirst.padStart(9)}`,
    )
  })

  console.log('─'.repeat(90))
  const totals = entries.map(combinedTotal)
  console.log(
    `Sparkline (combined total, min-max scaled): ${sparkline(totals)}`,
  )

  const lastTotal = combinedTotal(entries[entries.length - 1]!)
  const overallDeltaPct =
    firstTotal > 0 ? ((lastTotal - firstTotal) / firstTotal) * 100 : 0
  console.log(
    `Overall: ${fmtMs(firstTotal)}ms -> ${fmtMs(lastTotal)}ms (${fmtPct(overallDeltaPct)}) over ${entries.length} run(s)`,
  )

  // Per-category drift, first vs last entry in the window.
  const firstEntry = entries[0]!
  const lastEntry = entries[entries.length - 1]!
  const allCategories = new Set([
    ...Object.keys(firstEntry.categories),
    ...Object.keys(lastEntry.categories),
  ])
  if (entries.length > 1 && allCategories.size > 0) {
    console.log('\n── By category (first vs last in window) ──')
    for (const cat of allCategories) {
      const f = firstEntry.categories[cat]
      const l = lastEntry.categories[cat]
      const fTotal = f ? f.svgMs + f.asciiMs : 0
      const lTotal = l ? l.svgMs + l.asciiMs : 0
      const delta = fTotal > 0 ? ((lTotal - fTotal) / fTotal) * 100 : 0
      console.log(
        `  ${cat.padEnd(16)} ${fmtMs(fTotal).padStart(8)}ms -> ${fmtMs(lTotal).padStart(8)}ms  ${fmtPct(delta)}`,
      )
    }
  }

  console.log()
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main()
}
