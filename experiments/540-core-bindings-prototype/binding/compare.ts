// Comparison harness for the #540 prototype: runs the real TypeScript ASCII
// renderer (src/ascii/index.ts, unmodified) and the Go-core-via-subprocess
// path side by side on the three fixture inputs in ../fixtures, and reports
// whether the output bytes match exactly.
//
// Run with: pnpm exec tsx experiments/540-core-bindings-prototype/binding/compare.ts
// (from the repo root, after `go build -o core main.go` in ../core).

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { renderMermaidASCII } from '../../../src/ascii/index.ts'
import { renderViaCore } from './render.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(here, '..', 'fixtures')

const fixtureFiles = readdirSync(fixturesDir)
  .filter((f) => f.endsWith('.mmd'))
  .sort()

let allMatch = true

for (const file of fixtureFiles) {
  const name = file.replace(/\.mmd$/, '')
  const source = readFileSync(path.join(fixturesDir, file), 'utf8')

  const real = renderMermaidASCII(source, { useAscii: true })
  const { stdout: core, stderr } = renderViaCore(source)

  const match = real === core
  allMatch = allMatch && match

  console.log(`\n===== ${name} ${match ? 'MATCH' : 'MISMATCH'} =====`)
  if (!match) {
    console.log('--- real (src/ascii) ---')
    console.log(real)
    console.log('--- core (Go subprocess) ---')
    console.log(core)
    if (stderr) {
      console.log('--- core stderr ---')
      console.log(stderr)
    }
  } else {
    console.log(core)
  }
}

console.log(
  `\n${allMatch ? 'All fixtures match byte-for-byte.' : 'Some fixtures differ — see above.'}`,
)
process.exit(allMatch ? 0 : 1)
