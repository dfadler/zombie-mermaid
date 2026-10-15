/**
 * Bundle-size gate for the published package's `dist/` output.
 *
 * A size-limit/bundlewatch-style check: gzips each budgeted file in `dist/`
 * (source maps excluded — they never ship, see `files` in package.json) and
 * fails if any exceeds the budget recorded in bundle-size-budget.json. This
 * is deliberately a small in-house script rather than a new dependency
 * (`size-limit`, `bundlewatch`, ...) — consistent with this repo's own
 * "zero DOM dependencies" / dependency-minimalism stance, and gzip-via-
 * node:zlib is all the check needs.
 *
 * Usage: pnpm run build && tsx scripts/check-bundle-size.ts
 *
 * Budgets = measured CI size + 2% (CONTRIBUTING.md, "Bundle size budgets" says
 * when a raise is justified). To raise one, edit
 * bundle-size-budget.json directly (no separate "update" mode — a size
 * budget should be a deliberate, visible diff, not a regenerated snapshot).
 */

import { readFile, readdir, stat } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { bundleSource } from './vite-bundle.ts'
import { fileURLToPath } from 'node:url'

interface BudgetFile {
  unit: string
  budgets: Record<string, number>
  /** Minified browser bundle of the entry, `elkjs` NOT registered (#1370). */
  consumerBundles: Record<string, number>
  /** Unpacked bytes of each package's dist/ (source maps excluded), #1569. */
  unpackedBudgets: Record<string, number>
}

const EXIT_OK = 0
const EXIT_FAILURE = 1

/** One row: exact bytes, budget, remaining headroom (negative = over). Returns true if over. */
function report(label: string, size: number, budget: number): boolean {
  const headroom = ((budget - size) / budget) * 100
  const over = size > budget
  console.log(
    `  ${label.padEnd(42)} ${String(size).padStart(7)} B / ${String(budget).padStart(7)} B  headroom ${`${headroom.toFixed(1)}%`.padStart(6)}  ${over ? 'OVER' : 'ok'}`,
  )
  return over
}

const budgetFile = JSON.parse(
  await readFile(
    new URL('./bundle-size-budget.json', import.meta.url),
    'utf-8',
  ),
) as BudgetFile

console.log(`Bundle size check (${budgetFile.unit})`)
console.log('─'.repeat(70))

let anyOverBudget = false
let anyMissing = false

for (const [relPath, budget] of Object.entries(budgetFile.budgets)) {
  const absPath = new URL(`../${relPath}`, import.meta.url)
  let raw: Buffer
  try {
    raw = await readFile(absPath)
  } catch {
    console.error(
      `  ${relPath.padEnd(20)} MISSING — run \`pnpm run build\` first`,
    )
    anyMissing = true
    continue
  }

  const gzipSize = gzipSync(raw).length
  if (report(relPath, gzipSize, budget)) anyOverBudget = true
}

// A consumer's bundler must not pull in `elkjs` unless the consumer registers
// it (#1370): bundle each entry the way an app would and gate the result.
console.log('\nConsumer bundles, elkjs unregistered (minified, gzip)')
console.log('─'.repeat(70))
for (const [relPath, budget] of Object.entries(budgetFile.consumerBundles)) {
  const entry = fileURLToPath(new URL(`../${relPath}`, import.meta.url))
  const result = await bundleSource(
    `export * from ${JSON.stringify(entry)}`,
    fileURLToPath(new URL('..', import.meta.url)),
  ).catch(() => null)
  if (!result) {
    console.error(
      `  ${relPath.padEnd(20)} MISSING — run \`pnpm run build\` first`,
    )
    anyMissing = true
    continue
  }
  const gzipSize = gzipSync(Buffer.from(result)).length
  if (report(relPath, gzipSize, budget)) anyOverBudget = true
}

// Per-package unpacked size (#1569): total bytes of dist/, minus .map files
// (not published). Catches growth that per-file gzip budgets can miss, e.g.
// a new chunk or .d.ts bloat.
console.log('\nUnpacked dist/ size per package (no source maps)')
console.log('─'.repeat(70))
for (const [relDir, budget] of Object.entries(budgetFile.unpackedBudgets)) {
  let size = 0
  try {
    const dir = fileURLToPath(new URL(`../${relDir}`, import.meta.url))
    for (const f of await readdir(dir, { recursive: true })) {
      if (f.endsWith('.map')) continue
      const st = await stat(`${dir}/${f}`)
      if (st.isFile()) size += st.size
    }
  } catch {
    console.error(
      `  ${relDir.padEnd(20)} MISSING — run \`pnpm run build\` first`,
    )
    anyMissing = true
    continue
  }
  if (report(relDir, size, budget)) anyOverBudget = true
}

if (anyMissing) {
  console.error('\nFAIL: one or more budgeted dist/ files were not built.')
  process.exit(EXIT_FAILURE)
}

if (anyOverBudget) {
  console.error(
    '\nFAIL: one or more dist/ files exceeded their gzip size budget.',
  )
  console.error(
    'If the increase is intentional and reviewed, raise the budget in bundle-size-budget.json in the same PR and justify the increase in the PR description and say in the PR body whether it is new feature code (raise) or a regression (fix instead); see CONTRIBUTING.md, "Bundle size budgets".',
  )
  process.exit(EXIT_FAILURE)
}

console.log('\nOK: all files within budget.')
process.exit(EXIT_OK)
