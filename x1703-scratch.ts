import { renderMermaidASCII } from './src/index.ts'
import { xychartSamples } from './packages/site/xychart-samples-data.ts'
import { TERMINAL_ASCII_OPTS } from './__tests__/visual/helpers/terminal-panel.ts'
let fail = 0
let nd = 0
for (const s of xychartSamples) {
  try {
    const a = renderMermaidASCII(s.source, TERMINAL_ASCII_OPTS)
    const b = renderMermaidASCII(s.source, TERMINAL_ASCII_OPTS)
    if (a !== b) nd++
  } catch (e) {
    fail++
    console.log('FAIL', s.title, String(e).slice(0, 80))
  }
}
console.log(xychartSamples.length, 'fail', fail, 'nondeterministic', nd)
