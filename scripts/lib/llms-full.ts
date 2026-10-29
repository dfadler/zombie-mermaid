/**
 * Builds the text of `public/llms-full.txt`: the repo files that
 * `public/llms.txt` links on github.com (docs/*.md, package READMEs),
 * concatenated under `# <url>` headings.
 */
import { readFile } from 'node:fs/promises'

const BLOB = 'https://github.com/dfadler/zombie-mermaid/blob/main/'
const root = (p: string) => new URL(`../../${p}`, import.meta.url)

/** Rewrite relative markdown links against the source doc's GitHub URL. */
export function absolutizeLinks(markdown: string, path: string): string {
  return markdown.replace(/\]\(([^)\s]+)\)/g, (whole, target: string) =>
    /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)
      ? whole
      : `](${new URL(target, BLOB + path).href})`,
  )
}

export async function generateLlmsFull(): Promise<string> {
  const index = await readFile(root('public/llms.txt'), 'utf8')
  const link = new RegExp(`\\]\\(${BLOB.replaceAll('.', '\\.')}([^)]+)\\)`, 'g')
  const paths = [...new Set([...index.matchAll(link)].map((m) => m[1]))]
  const parts = await Promise.all(
    paths.map(
      async (p) =>
        `# ${BLOB}${p}\n\n${absolutizeLinks((await readFile(root(p), 'utf8')).trim(), p)}\n`,
    ),
  )
  return `${index.trim()}\n\n---\n\n${parts.join('\n---\n\n')}`
}
