/**
 * Measure the layout-faithful rasterizer over every flat, supported flowchart in the gallery
 * (plus any .mmd passed as an argument). Prints one row per case and a summary.
 *   pnpm exec tsx scripts/ascii-layout-table.ts [--show] [file.mmd ...]
 */
import { readFileSync } from 'node:fs'
import { UnsupportedFlowchartError } from '../packages/elk-layout/src/index.ts'
import { renderFlowchartAscii } from '../packages/ascii-layout/src/index.ts'
import { samples } from '../packages/site/samples-data.ts'

const show = process.argv.includes('--show')
const targets = process.argv
  .slice(2)
  .filter((a) => !a.startsWith('--'))
  .map((f) => ({ name: f.replace(/.*\//, ''), src: readFileSync(f, 'utf8') }))
samples.forEach((s, i) => {
  if (/^\s*(flowchart|graph)\b/.test(s.source))
    targets.push({ name: `s${i} ${s.title.slice(0, 26)}`, src: s.source })
})

console.log(
  'case | rows x cols | max box err | boxes>15% | edges->lines (merged) | crossings | broken border cells | arrows adj | gap',
)
let n = 0
let over = 0
let merged = 0
let cross = 0
let broken = 0
let relaxed = 0
let cols = 0
let maxCols = 0
for (const t of targets) {
  try {
    const { text, stats: m } = await renderFlowchartAscii(t.src)
    console.log(
      [
        t.name,
        `${m.rows}x${m.cols}`,
        `${(m.maxBoxError * 100).toFixed(0)}%`,
        m.boxesOver15Pct,
        `${m.edges}->${m.lines} (${m.merged})`,
        m.crossings,
        m.brokenBorderCells,
        `${m.arrowheadsAdjacent}/${m.arrowheads}`,
        m.relaxed ? 'RELAXED' : m.gap,
      ].join(' | '),
    )
    if (show) console.log(text + '\n')
    n++
    over += m.boxesOver15Pct
    merged += m.merged
    cross += m.crossings
    broken += m.brokenBorderCells
    relaxed += +m.relaxed
    cols += m.cols
    maxCols = Math.max(maxCols, m.cols)
  } catch (e) {
    if (!(e instanceof UnsupportedFlowchartError)) throw e
    console.log(`${t.name} | unsupported: ${e.reasons.join(', ')}`)
  }
}
console.log(
  `SUMMARY cases=${n} boxes>15%=${over} merged edges=${merged} crossings=${cross} broken border cells=${broken} relaxed=${relaxed} avg cols=${(cols / n).toFixed(0)} max cols=${maxCols}`,
)
