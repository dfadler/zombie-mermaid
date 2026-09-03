/**
 * Generates .form-facts/<id>.json — one file per sample in samples-data.ts,
 * each holding {source, trimmedSvg, asciiText} — plus form-facts-index.json,
 * a small index of {id, category, title, path, judgeable}.
 *
 * Split this way specifically for the form-judge workflow
 * (scripts/form-judge.workflow.mjs): a Workflow script has no filesystem
 * access, so per-sample data has to reach each judge agent some other way.
 * Passing the full dataset through the workflow's `args` would mean the
 * orchestrating session has to read the whole ~1.6MB dump into its own
 * context just to relay it — most of that context spent on samples no
 * single agent needs. Instead, each judge agent gets only its own file
 * path in its prompt and reads that one (small) file itself with its own
 * Read tool — the index (tiny) is what actually flows through `args`.
 *
 * Usage: tsx scripts/form-facts.ts [--category=Sequence]
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { renderMermaidASCII } from '../src/index.ts'
import { samples } from '../samples-data.ts'
import {
  startRealMermaid,
  renderRealMermaidSvg,
  trimMermaidSvg,
} from './lib/real-mermaid.ts'

const categoryArg = process.argv.find((a) => a.startsWith('--category='))
const CATEGORY_FILTER = categoryArg
  ? categoryArg.slice('--category='.length)
  : undefined

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface SampleFile {
  id: string
  category: string
  title: string
  source: string
  trimmedSvg: string | null
  mermaidError: string | null
  asciiText: string | null
  asciiError: string | null
}

export interface IndexEntry {
  id: string
  category: string
  title: string
  path: string
  judgeable: boolean
  mermaidError: string | null
  asciiError: string | null
}

async function generate(): Promise<IndexEntry[]> {
  const indexed = samples
    .map((sample, i) => ({ sample, i }))
    .filter(({ sample }) => {
      if (sample.category === 'Hero') return false
      if (CATEGORY_FILTER && sample.category !== CATEGORY_FILTER) return false
      return true
    })

  console.log(
    `Rendering ${indexed.length} sample(s)${CATEGORY_FILTER ? ` (category: ${CATEGORY_FILTER})` : ''}…`,
  )

  const factsDir = new URL('../.form-facts/', import.meta.url)
  await mkdir(factsDir, { recursive: true })

  const session = await startRealMermaid()
  const index: IndexEntry[] = []

  try {
    for (const { sample, i } of indexed) {
      const id = `form-${i}-${slug(sample.category ?? 'uncategorized')}-${slug(sample.title)}`

      let trimmedSvg: string | null = null
      let mermaidError: string | null = null
      try {
        const svg = await renderRealMermaidSvg(
          session,
          id.replace(/-/g, '_'),
          sample.source,
        )
        trimmedSvg = trimMermaidSvg(svg)
      } catch (err) {
        mermaidError = err instanceof Error ? err.message : String(err)
      }

      let asciiText: string | null = null
      let asciiError: string | null = null
      try {
        asciiText = renderMermaidASCII(sample.source, {
          colorMode: 'none',
        }).replace(/[ \t]+$/gm, '')
      } catch (err) {
        asciiError = err instanceof Error ? err.message : String(err)
      }

      const file: SampleFile = {
        id,
        category: sample.category ?? 'uncategorized',
        title: sample.title,
        source: sample.source,
        trimmedSvg,
        mermaidError,
        asciiText,
        asciiError,
      }
      const filePath = new URL(`${id}.json`, factsDir)
      await writeFile(filePath, JSON.stringify(file, null, 2), 'utf8')

      index.push({
        id,
        category: file.category,
        title: file.title,
        path: fileURLToPath(filePath),
        judgeable: trimmedSvg !== null && asciiText !== null,
        mermaidError,
        asciiError,
      })
    }
  } finally {
    await session.close()
  }

  return index
}

const index = await generate()
const indexPath = fileURLToPath(
  new URL('../form-facts-index.json', import.meta.url),
)
await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8')
const judgeable = index.filter((e) => e.judgeable).length
console.log(
  `Written ${index.length} file(s) to .form-facts/, index at ${indexPath} (${judgeable} judgeable, ${index.length - judgeable} skipped)`,
)
