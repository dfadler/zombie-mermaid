import { createHash } from 'node:crypto'
import { samples } from '../packages/site/samples-data.ts'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
const generateFlowchart = (n: number) => { const W = 4; const l = ['graph TD']; for (let i = 0; i < n; i++) l.push(`  n${i}[Step ${i}]`); for (let i = 0; i + W < n; i++) { l.push(`  n${i} --> n${i + W}`); if (i % 2 === 0 && (i % W) + 1 < W) l.push(i % 4 === 0 ? `  n${i} -->|ok| n${i + W + 1}` : `  n${i} --> n${i + W + 1}`) } return l.join('\n') }

const h = createHash('sha256')
for (const s of samples) {
  try {
    h.update(renderMermaidASCII(s.source))
  } catch {
    h.update('ERR')
  }
}
for (const n of [50, 100, 200]) h.update(renderMermaidASCII(generateFlowchart(n)))
console.log(h.digest('hex'))
