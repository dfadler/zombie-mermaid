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
 * To raise a budget after an intentional, reviewed size increase, edit
 * bundle-size-budget.json directly (no separate "update" mode — a size
 * budget should be a deliberate, visible diff, not a regenerated snapshot).
 */

import { readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

interface BudgetFile {
  unit: string
  budgets: Record<string, number>
}

const EXIT_OK = 0
const EXIT_FAILURE = 1

function fmtBytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`
}

function fmtPct(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

const budgetFile = JSON.parse(
  await readFile(
    new URL('../bundle-size-budget.json', import.meta.url),
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
  const pct = ((gzipSize - budget) / budget) * 100
  const status = gzipSize > budget ? 'OVER' : 'ok'
  console.log(
    `  ${relPath.padEnd(20)} ${fmtBytes(gzipSize).padStart(10)} / ${fmtBytes(budget).padStart(10)} budget  ${fmtPct(pct).padStart(7)}  ${status}`,
  )

  if (gzipSize > budget) anyOverBudget = true
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
    'If the increase is intentional and reviewed, raise the budget in bundle-size-budget.json.',
  )
  process.exit(EXIT_FAILURE)
}

console.log('\nOK: all files within budget.')
process.exit(EXIT_OK)
