/**
 * Numeric comparison of @zombie-mermaid/elk-layout against real mermaid.js (headless
 * Chromium, via scripts/lib/real-mermaid.ts): exact node size/position and edge-point
 * deltas, not just relative placement (that is scripts/layout-oracle.ts).
 *
 * Usage: tsx scripts/elk-layout-oracle.ts [--tol=1] [--gallery] [file.mmd ...]
 *   --gallery   every flat, supported flowchart sample in samples/samples-data.ts
 * Needs Chromium (`pnpm exec playwright install chromium`); the unit tests do not.
 * Exit code 1 if any node or edge is off by more than --tol px.
 *
 * "Exact" is exact against the font table the module ships (see packages/elk-layout/README.md);
 * on a machine whose Chromium resolves "trebuchet ms" differently, regenerate it first with
 * `pnpm run elk-layout:font`.
 */
import { readFileSync } from 'node:fs'
import {
  layoutFlowchart,
  UnsupportedFlowchartError,
} from '../packages/elk-layout/src/index.ts'
import type { FlowchartLayout } from '../packages/elk-layout/src/index.ts'
import { samples } from '../samples/samples-data.ts'
import { oracleLayout, startRealMermaid } from './lib/oracle-layout.ts'

const tol = +(process.argv.find((a) => a.startsWith('--tol='))?.slice(6) ?? 1)
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const targets: { name: string; src: string }[] = files.map((f) => ({
  name: f.replace(/.*\//, ''),
  src: readFileSync(f, 'utf8'),
}))
if (process.argv.includes('--gallery')) {
  samples.forEach((s, i) => {
    if (/^\s*(flowchart|graph)\b/.test(s.source))
      targets.push({ name: `s${i} ${s.title.slice(0, 28)}`, src: s.source })
  })
}

// Mermaid 12.1.0 already defaults to ELK for flowcharts, so forcing `layout: elk` is harmless
// but redundant; it is kept so the oracle stays on ELK if a future default changes.
const withElk = (src: string) => `%%{init: {"layout": "elk"}}%%\n${src}`

const s = await startRealMermaid()
let bad = 0
const rows: string[] = []
for (const { name, src } of targets) {
  let mine: FlowchartLayout
  try {
    mine = await layoutFlowchart(src)
  } catch (e) {
    if (!(e instanceof UnsupportedFlowchartError)) throw e
    rows.push(`${name.padEnd(34)} unsupported: ${e.reasons.join(', ')}`)
    continue
  }
  let o
  try {
    o = await oracleLayout(s, withElk(src))
  } catch (e) {
    rows.push(
      `${name.padEnd(34)} oracle read failed: ${String(e).split('\n')[0]}`,
    )
    bad++
    continue
  }
  const mn = new Map(mine.nodes.map((n) => [n.id, n]))
  let nodeMax = 0,
    sizeMax = 0,
    missing = 0
  for (const n of o.nodes) {
    const k = mn.get(n.id)
    if (!k) {
      missing++
      continue
    }
    nodeMax = Math.max(nodeMax, Math.abs(k.x - n.x), Math.abs(k.y - n.y))
    sizeMax = Math.max(sizeMax, Math.abs(k.w - n.w), Math.abs(k.h - n.h))
  }
  const me = new Map(mine.edges.map((e) => [e.id, e]))
  let edgeOk = 0,
    edgeMax = 0
  for (const e of o.edges) {
    const k = me.get(e.id)
    if (!k || k.pts.length !== e.pts.length) continue
    const d = Math.max(
      ...e.pts.map((p, i) =>
        Math.max(Math.abs(p[0] - k.pts[i]![0]), Math.abs(p[1] - k.pts[i]![1])),
      ),
    )
    edgeMax = Math.max(edgeMax, d)
    if (d <= tol) edgeOk++
  }
  if (missing || nodeMax > tol || sizeMax > tol || edgeOk < o.edges.length)
    bad++
  rows.push(
    `${name.padEnd(34)} n=${String(o.nodes.length).padStart(2)} e=${String(o.edges.length).padStart(2)} | node posΔmax ${nodeMax.toFixed(1).padStart(6)} sizeΔmax ${sizeMax.toFixed(1).padStart(5)} | edges within tol ${edgeOk}/${o.edges.length} (maxΔ of same-length ${edgeMax.toFixed(1)})`,
  )
}
console.log(`tol=${tol}px\n${rows.join('\n')}`)
await s.close()
process.exit(bad ? 1 : 0)
