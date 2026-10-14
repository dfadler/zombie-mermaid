// Markdown summary of reports/mutation/mutation.json for the job summary (#1862).
// Score = (Killed + Timeout) / (Killed + Timeout + Survived + NoCoverage).
import { readFileSync } from 'node:fs'

const report = JSON.parse(
  readFileSync('reports/mutation/mutation.json', 'utf8'),
)
const pct = (c) => {
  const k = (c.Killed || 0) + (c.Timeout || 0)
  const d = k + (c.Survived || 0) + (c.NoCoverage || 0)
  return d ? ((100 * k) / d).toFixed(1) : 'n/a'
}
const total = {}
const rows = Object.entries(report.files).map(([file, { mutants }]) => {
  const c = {}
  for (const m of mutants) {
    c[m.status] = (c[m.status] || 0) + 1
    total[m.status] = (total[m.status] || 0) + 1
  }
  return `| ${file} | ${pct(c)} | ${c.Survived || 0} | ${c.NoCoverage || 0} |`
})
console.log(`## Mutation score: ${pct(total)}%\n`)
console.log('| File | Score % | Survived | No coverage |\n|---|---|---|---|')
console.log(rows.join('\n'))
