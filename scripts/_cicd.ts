import { samples } from '../packages/site/samples-data.ts'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const src = samples.find((s) => s.title.includes('CI/CD'))!.source
const all = samples.map((s) => s.source)
const med = (fn: () => void, n: number) => {
  for (let i = 0; i < 5; i++) fn()
  const t: number[] = []
  for (let i = 0; i < n; i++) {
    const t0 = performance.now()
    fn()
    t.push(performance.now() - t0)
  }
  return t.sort((a, b) => a - b)[Math.floor(n / 2)]!
}
console.log('cicd ms', med(() => renderMermaidASCII(src), 40).toFixed(2))
console.log(
  'all-samples ms',
  med(() => {
    for (const s of all) {
      try {
        renderMermaidASCII(s)
      } catch {}
    }
  }, 15).toFixed(1),
)
