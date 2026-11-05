import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { samples } from '../samples/samples-data.ts'
import { parseMermaid } from '../src/index.ts'
import { agreement, type LayoutBoxes, type Box } from './lib/layout-agreement.ts'
import { measureOurs } from './lib/measure-ours.ts'
import { layoutGraphSync } from '../packages/svg-renderer/src/layout-engine.ts'
import { protoBoxes } from './_elk-proto.ts'
import { startRealMermaid, renderRealMermaidSvg } from './lib/real-mermaid.ts'
const N = process.env.NOTES!  // parity-fanout notes dir (extra.json)
const DIST = process.env.MM_DIST!
const cache = process.env.SCORE_CACHE!
const extra = JSON.parse(readFileSync(N + '/extra.json', 'utf8')) as { title: string; source: string }[]
import { allForkFixes } from '../demo/fork-fixes-data.ts'
import { globSync } from 'node:fs'
const isSg = (src: string) => /^\s*(flowchart|graph)\b/m.test(src.replace(/^---[\s\S]*?---/, '')) && /^\s*subgraph/m.test(src)
const docBlocks: { title: string; source: string }[] = []
for (const f of [...globSync('docs/*.md'), 'README.md']) for (const [i, m] of [...readFileSync(f, 'utf8').matchAll(/```mermaid\n([\s\S]*?)```/g)].entries()) if (isSg(m[1]!)) docBlocks.push({ title: 'doc:' + f + '#' + i, source: m[1]! })
const forkFix = (allForkFixes as any[]).filter((s) => isSg(s.source ?? '')).map((s) => ({ title: 'ff:' + s.id, source: s.source as string }))
function rng(seed: number) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) }
const fuzz: { title: string; source: string }[] = []
for (let k = 0; k < Number(process.env.FUZZ ?? 0); k++) {
  const r = rng(k + 1), pick = (n: number) => Math.floor(r() * n)
  const n = 5 + pick(6), shapes = ['[', '{', '(', '((', '[/']; const close: Record<string, string> = { '[': ']', '{': '}', '(': ')', '((': '))', '[/': '/]' }
  const nodeDef = (i: number) => { const s = shapes[pick(shapes.length)]!; return 'N' + i + s + 'node ' + 'x'.repeat(pick(8)) + i + close[s] }
  const sgn = pick(3), lines = ['flowchart ' + ['LR', 'TD'][pick(2)]], used = new Set<number>()
  for (let g = 0; g < sgn; g++) { lines.push('subgraph S' + g + '[Sub ' + g + ' title long long]'); const m = 2 + pick(3); for (let j = 0; j < m; j++) { const i = pick(n); if (!used.has(i)) { used.add(i); lines.push(nodeDef(i)) } } lines.push('end') }
  for (let i = 0; i < n; i++) if (!used.has(i) && r() < 0.5) { used.add(i); lines.push(nodeDef(i)) }
  const ec = n + pick(6); for (let e = 0; e < ec; e++) lines.push('N' + pick(n) + ' --> N' + pick(n))
  fuzz.push({ title: 'fz' + k, source: lines.join('\n') + '\n' })
}
const seen = new Set<string>()
const dedupe = (l: { title: string; source: string }[]) => l.filter((s) => (seen.has(s.source) ? false : (seen.add(s.source), true)))
const list = dedupe([...extra, ...forkFix, ...docBlocks, ...fuzz, ...samples.filter((s) => /^\s*(flowchart|graph)\b/m.test(s.source.replace(/^---[\s\S]*?---/, '')) && /^\s*subgraph/m.test(s.source))])
const refs: Record<string, LayoutBoxes> = existsSync(cache) ? JSON.parse(readFileSync(cache, 'utf8')) : {}
const need = list.filter((s) => !refs[s.title])
if (need.length) {
  const sess = await startRealMermaid(DIST)
  await sess.page.evaluate('window.__name = (f) => f')
  for (const [i, s] of need.entries()) {
    try {
      const svg = await renderRealMermaidSvg(sess, 'r' + i, s.source)
      refs[s.title] = await sess.page.evaluate(([m, id]) => {
        document.body.innerHTML = m as string
        const o = document.querySelector('svg')!.getBoundingClientRect()
        const bx = (el: Element) => { const r = el.getBoundingClientRect(); return { x: r.x - o.x, y: r.y - o.y, w: r.width, h: r.height } }
        const nodes: any = {}, groups: any = {}
        for (const g of document.querySelectorAll('g.node')) { const mm = /flowchart-(.+)-\d+$/.exec(g.getAttribute('id') ?? ''); if (mm) nodes[mm[1]!] = bx(g) }
        for (const g of document.querySelectorAll('g.cluster')) { const r = g.querySelector('rect'); if (r) { const raw = g.getAttribute('id') ?? ''; groups[raw.startsWith(id + '-') ? raw.slice((id as string).length + 1) : raw] = bx(r) } }
        return { nodes, groups }
      }, [svg, 'r' + i] as [string, string])
    } catch (e) { refs[s.title] = { nodes: {}, groups: {} } }
  }
  await sess.close(); writeFileSync(cache, JSON.stringify(refs))
}
const modes: Record<string, (src: string) => LayoutBoxes> = {
  main: (s) => measureOurs(s, 'flowchart'),
  nested: (s) => { const p = layoutGraphSync(parseMermaid(s)); const nodes: Record<string, Box> = {}, groups: Record<string, Box> = {}; for (const n of p.nodes) nodes[n.id] = { x: n.x, y: n.y, w: n.width, h: n.height }; const w = (l: any[]) => { for (const g of l) { groups[g.id] = { x: g.x, y: g.y, w: g.width, h: g.height }; w(g.children) } }; w(p.groups); return { nodes, groups } },
  proto: (s) => protoBoxes(parseMermaid(s)),
  pNF: (s) => protoBoxes(parseMermaid(s), { noFeedback: true }),
  pGreedy: (s) => protoBoxes(parseMermaid(s), { rootOverride: { 'elk.layered.cycleBreaking.strategy': 'GREEDY' }, sgOverride: { 'elk.layered.cycleBreaking.strategy': 'GREEDY' } }),
  pNoMO: (s) => protoBoxes(parseMermaid(s), { rootOverride: { 'elk.layered.considerModelOrder.strategy': 'NONE' } }),
  pNoAlign: (s) => protoBoxes(parseMermaid(s), { rootOverride: { 'elk.layered.nodePlacement.bk.fixedAlignment': 'NONE' } }),
  pNS: (s) => protoBoxes(parseMermaid(s), { rootOverride: { 'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX' } }),
  pSep: (s) => protoBoxes(parseMermaid(s), { rootOverride: { 'elk.hierarchyHandling': 'SEPARATE_CHILDREN' } }),
  pBase: (s) => protoBoxes(parseMermaid(s), { rootOverride: { 'spacing.baseValue': 20 }, sgOverride: { 'spacing.baseValue': 20, 'spacing.nodeNode': 20 } }),
  protoLF: (s) => protoBoxes(parseMermaid(s), { leavesFirst: true }),
}
const which = (process.env.MODES ?? 'main,nested,proto').split(',')
const cont: Record<string, number[]> = Object.fromEntries(which.map((m) => [m, [0, 0]]))
const tot: Record<string, number[]> = Object.fromEntries(which.map((m) => [m, [0, 0]]))
for (const s of list) {
  const r = refs[s.title]; if (!r || !Object.keys(r.nodes).length) continue
  const row: string[] = []
  for (const m of which) {
    try {
      const a = agreement(r, modes[m]!(s.source), Number(process.env.TOL ?? 20))
      const n = Object.keys(r.nodes).length; const pairs = n * (n - 1) / 2
      const ok = Math.round(((a.vertical ?? 0) + (a.horizontal ?? 0)) * pairs)
      tot[m]![0] += ok; tot[m]![1] += pairs * 2; const gm = Object.keys(r.groups).length * n; if (a.containment !== null) { cont[m]![0] += Math.round(a.containment * gm); cont[m]![1] += gm }
      row.push(m + ' v' + (a.vertical === null ? '-' : Math.round(a.vertical * 100)) + ' h' + (a.horizontal === null ? '-' : Math.round(a.horizontal * 100)))
    } catch (e) { row.push(m + ' ERR ' + (e as Error).message.slice(0, 40)) }
  }
  console.log(s.title.slice(0, 34).padEnd(35), row.join(' | '))
}
for (const m of which) console.log('TOTAL', m, tot[m]![0] + '/' + tot[m]![1], (100 * tot[m]![0] / tot[m]![1]).toFixed(1) + '%', 'containment', cont[m]![0] + '/' + cont[m]![1])
