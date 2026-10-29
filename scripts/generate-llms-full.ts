/**
 * Writes `public/llms-full.txt`: the repo files that `public/llms.txt` links on
 * github.com (docs/*.md, package READMEs), concatenated under `# <url>`
 * headings. `__tests__/llms-full.test.ts` fails when the committed file is
 * stale; run `pnpm run docs:llms`.
 */
import { writeFile } from 'node:fs/promises'
import { generateLlmsFull } from './lib/llms-full.ts'

await writeFile(
  new URL('../public/llms-full.txt', import.meta.url),
  await generateLlmsFull(),
)
