/**
 * Label-placement scaling benchmark (#1466).
 *
 * `clearOfEarlierLabels` (draw-arrows.ts) re-resolves every later edge's label
 * for each eligible vertical-leg edge, so cost could be quadratic in labelled
 * edges. This renders LR graphs with N labelled edges (the #1463 shared-stem
 * shape, scaled) and the same graphs with labels stripped; the difference is
 * the label-placement cost. Report-only, not part of the CI gate.
 *
 * Usage: tsx scripts/bench-label-placement.ts [--runs=<n>] [--sizes=10,20,40,80]
 */
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const arg = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const RUNS = Number(arg('runs') ?? 5)
const SIZES = (arg('sizes') ?? '10,20,40,80').split(',').map(Number)

/**
 * LR graph of `n` labelled edges: a chain S0..S(n-1) plus every Si -> a shared
 * sink and Si -> a shared hub, so many labels land on shared vertical legs
 * (the #1433/#1463 shape) without duplicate parallel edges.
 */
export function generateLabelled(n: number, labelled = true): string {
  const lines = ['flowchart LR']
  const l = (i: number) => (labelled ? `|l${i}|` : '')
  for (let i = 0; i < n; i++) {
    lines.push(`  S${i} -->${l(2 * i)} Sink`)
    lines.push(`  S${i} -->${l(2 * i + 1)} Hub`)
    if (i > 0) lines.push(`  S${i - 1} --> S${i}`)
  }
  return lines.join('\n')
}

function median(fn: () => unknown): number {
  fn()
  const t: number[] = []
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now()
    fn()
    t.push(performance.now() - t0)
  }
  t.sort((a, b) => a - b)
  return t[Math.floor(t.length / 2)]!
}

console.log(`\nLabel-placement scaling (median of ${RUNS} runs)`)
console.log('edges  labelled(ms)  unlabelled(ms)  label cost(ms)')
for (const n of SIZES) {
  const opts = { colorMode: 'none' as const }
  const lab = median(() => renderMermaidASCII(generateLabelled(n), opts))
  const plain = median(() =>
    renderMermaidASCII(generateLabelled(n, false), opts),
  )
  console.log(
    `${String(n).padStart(5)}  ${lab.toFixed(1).padStart(12)}  ${plain.toFixed(1).padStart(14)}  ${(lab - plain).toFixed(1).padStart(14)}`,
  )
}
