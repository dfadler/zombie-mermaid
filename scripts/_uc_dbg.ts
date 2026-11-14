import { startRealMermaid, renderRealMermaidSvg } from './lib/real-mermaid.ts'
import { samples } from '../samples/samples-data.ts'
import { renderMermaidSVG } from '../src/index.ts'
import { parseOfficialUsecaseSvg, parseOurUsecaseSvg } from './lib/usecase-agreement.ts'
const s = await startRealMermaid()
const want = process.argv[2]!
const src = samples.find((x) => x.title === want)!.source
const o = parseOfficialUsecaseSvg(await renderRealMermaidSvg(s, 'dbg', src))
const u = parseOurUsecaseSvg(renderMermaidSVG(src))
const f = (b: any) => `${b.id.padEnd(12)} ${b.kind.padEnd(8)} c=(${b.cx.toFixed(1)},${b.cy.toFixed(1)}) ${b.width.toFixed(1)}x${b.height.toFixed(1)} "${b.label}"`
console.log('OFFICIAL', o.size); o.boxes.forEach((b) => console.log(f(b)))
console.log('OURS', u.size); u.boxes.forEach((b) => console.log(f(b)))
console.log(JSON.stringify(o.edges)); console.log(JSON.stringify(u.edges))
await s.close()
