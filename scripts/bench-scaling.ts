/**
 * Large-diagram scaling benchmark (#1425).
 *
 * `bench.ts` only times the ~90 hand-written samples, all tens of nodes. The
 * ASCII pathfinder's super-linear cost only shows on larger graphs, so this
 * times generated flowcharts of 100/200/300 nodes (pass --sizes=...,400 for more; 400 took ~2 min per run before #1424) through parse, SVG and
 * ASCII, reporting the median of `--runs` timed runs (after one warm-up).
 *
 * Report-only: deliberately NOT part of `bench-baseline.json` / the CI gate.
 * A handful of runs of multi-second renders is too noisy to gate on, and
 * adding a 400-node case to the gated total would let one size dominate it.
 * Use it to measure a perf change before/after (same machine, back to back).
 *
 * Usage: tsx scripts/bench-scaling.ts [--json=<path>] [--runs=<n>] [--sizes=100,200,300]
 */

import { writeFile } from 'node:fs/promises'
import { decodeXML } from 'entities'
import { renderMermaid } from '../src/index.ts'
import { diagramRegistry } from '../packages/svg-renderer/src/registry.ts'
import { detectDiagramType, splitStatements } from '@zombie-mermaid/core'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const arg = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)

const JSON_OUTPUT_PATH = arg('json') ?? null
const RUNS = Number(arg('runs') ?? 3)
const SIZES = (arg('sizes') ?? '100,200,300').split(',').map(Number)

/**
 * Deterministic layered CI/CD-style flowchart: rows of 4 nodes, each linked
 * to the node below it and, for every other node, diagonally to its neighbour
 * (one labelled), so routing has real crossings without the combinatorial
 * blow-up of a dense random graph.
 */
export function generateFlowchart(n: number): string {
  const W = 4
  const lines = ['graph TD']
  for (let i = 0; i < n; i++) lines.push(`  n${i}[Step ${i}]`)
  for (let i = 0; i + W < n; i++) {
    lines.push(`  n${i} --> n${i + W}`)
    const col = i % W
    if (i % 2 === 0 && col + 1 < W) {
      lines.push(
        i % 4 === 0
          ? `  n${i} -->|ok| n${i + W + 1}`
          : `  n${i} --> n${i + W + 1}`,
      )
    }
  }
  return lines.join('\n')
}

function parseOnly(source: string): void {
  const decoded = decodeXML(source)
  const type = detectDiagramType(decoded)
  diagramRegistry[type].parse(splitStatements(decoded), decoded)
}

async function median(fn: () => unknown): Promise<number> {
  await fn() // warm-up
  const times: number[] = []
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now()
    await fn()
    times.push(performance.now() - t0)
  }
  times.sort((a, b) => a - b)
  return times[Math.floor(times.length / 2)]!
}

const rows: {
  nodes: number
  parseMs: number
  svgMs: number
  asciiMs: number
}[] = []
console.log(`\nScaling benchmark (median of ${RUNS} runs)`)
console.log('nodes  parse(ms)    svg(ms)  ascii(ms)')
for (const nodes of SIZES) {
  const src = generateFlowchart(nodes)
  const parseMs = await median(() => parseOnly(src))
  const svgMs = await median(() => renderMermaid(src))
  const asciiMs = await median(() => renderMermaidASCII(src))
  rows.push({ nodes, parseMs, svgMs, asciiMs })
  console.log(
    `${String(nodes).padStart(5)}  ${parseMs.toFixed(1).padStart(9)}  ${svgMs.toFixed(1).padStart(9)}  ${asciiMs.toFixed(1).padStart(9)}`,
  )
}

if (JSON_OUTPUT_PATH) {
  await writeFile(
    JSON_OUTPUT_PATH,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), runs: RUNS, rows },
      null,
      2,
    ) + '\n',
  )
  console.log(`JSON summary written to ${JSON_OUTPUT_PATH}`)
}
