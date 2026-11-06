// Fail when public/llms-full.txt is stale, but only if a file it is generated
// from is among the changed files given as args (keeps `pnpm run verify` fast).
// Fix: pnpm run docs:llms
import { readFile } from 'node:fs/promises'
import {
  generateLlmsFull,
  llmsFullInputs,
  touchesLlmsFullInputs,
  toLf,
} from './lib/llms-full.ts'

const changed = process.argv.slice(2)
if (touchesLlmsFullInputs(changed, await llmsFullInputs())) {
  const committed = toLf(
    await readFile(new URL('../public/llms-full.txt', import.meta.url), 'utf8'),
  )
  if (committed !== (await generateLlmsFull())) {
    console.error(
      'error: public/llms-full.txt is stale (a doc it is generated from changed). Run: pnpm run docs:llms',
    )
    process.exitCode = 1
  }
}
