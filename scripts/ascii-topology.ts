/**
 * Scores how closely the ASCII grid's node placement and edge faces follow the
 * ELK layout, over the gallery flowchart/state samples plus the fork-fixes
 * entries (#2645). The numbers gate each ASCII placement PR (Q3).
 *
 * Usage: tsx scripts/ascii-topology.ts [--verbose] [--no-hints] [--dir TD|LR|RL|BT]
 */
import { allForkFixes } from '../demo/fork-fixes-data.ts'
import { samples } from '../samples/samples-data.ts'
import {
  addCounts,
  describeSample,
  emptyCounts,
  isExact,
  measureSample,
  redirectDirection,
} from './lib/ascii-topology.ts'
import type { Counts } from './lib/ascii-topology.ts'

/** Every ASCII fork-fix entry plus the subgraph frame merge, flowchart/state only. */
const inScope = (id: string): boolean =>
  id.startsWith('ascii-') || id === 'subgraph-frame-merge'
const isGraph = (src: string): boolean =>
  /^\s*(flowchart|graph|stateDiagram)/m.test(
    src.replace(/^---[\s\S]*?---/, '').trim(),
  )

const list = [
  ...samples
    .filter((s) => isGraph(s.source))
    .map((s) => ({ title: s.title, source: redirectDirection(s.source) })),
  ...allForkFixes
    .filter((f) => inScope(f.id) && isGraph(f.source))
    .map((f) => ({
      title: `ENTRY ${f.id}`,
      source: redirectDirection(f.source),
    })),
]
const verbose = process.argv.includes('--verbose')
let total = emptyCounts()
let exact = 0
for (const e of list) {
  const c: Counts = measureSample(e.source)
  total = addCounts(total, c)
  if (isExact(c)) exact++
  if (verbose || !isExact(c)) console.log(describeSample(e.title, c, verbose))
}
const pct = (a: number, b: number): string =>
  `${a}/${b} (${b ? ((100 * a) / b).toFixed(1) : '-'}%)`
console.log(
  `samples ${list.length}, exact ${exact}\n` +
    `layer pairs ${pct(total.layerOk, total.layerPairs)}\n` +
    `in-layer order pairs ${pct(total.orderOk, total.orderPairs)}\n` +
    `alignment pairs within ${0.5} node widths ${pct(total.alignOk, total.layerPairs)}, mean deviation ${(total.alignDev / total.layerPairs).toFixed(2)}\n` +
    `edge-end faces ${pct(total.faceOk, total.faceEnds)}`,
)
