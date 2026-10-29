/**
 * Writes `public/llms-full.txt`: the repo files that `public/llms.txt` links on
 * github.com (docs/*.md, package READMEs), concatenated under `# <url>`
 * headings. `__tests__/llms-full.test.ts` fails when the committed file is
 * stale; run `pnpm run docs:llms`.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const BLOB = 'https://github.com/dfadler/zombie-mermaid/blob/main/'
const root = (p: string) => new URL(`../${p}`, import.meta.url)

export async function generateLlmsFull(): Promise<string> {
  const index = await readFile(root('public/llms.txt'), 'utf8')
  const link = new RegExp(`\\]\\(${BLOB.replaceAll('.', '\\.')}([^)]+)\\)`, 'g')
  const paths = [...new Set([...index.matchAll(link)].map((m) => m[1]))]
  const parts = await Promise.all(
    paths.map(
      async (p) =>
        `# ${BLOB}${p}\n\n${(await readFile(root(p), 'utf8')).trim()}\n`,
    ),
  )
  return `${index.trim()}\n\n---\n\n${parts.join('\n---\n\n')}`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await writeFile(root('public/llms-full.txt'), await generateLlmsFull())
}
