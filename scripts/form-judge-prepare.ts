/**
 * Prepares one category's judging input for form-judge-weekly.yml, given
 * that category's already-rendered form-facts-index.json (from
 * scripts/form-facts.ts) and a restored verdict cache from a previous run.
 *
 * Resolves every non-judgeable entry and every cache hit deterministically
 * (no LLM call needed for either — see scripts/lib/form-judge-cache.ts),
 * writing them straight into the pre-seeded results file, and writes the
 * reduced set of genuinely-changed, judgeable samples to one combined data
 * file — so the judge agent reads its input once instead of once per
 * sample.
 *
 * Usage: tsx scripts/form-judge-prepare.ts \
 *   --index=form-facts-index.json \
 *   --cache=.form-judge-cache/<slug>.json \
 *   --data-out=form-judge-data-<slug>.json \
 *   --results-out=form-judge-results-<slug>.jsonl \
 *   --hashes-out=form-judge-hashes-<slug>.json
 */

import { readFile, writeFile } from 'node:fs/promises'
import type { IndexEntry, SampleFile } from './form-facts.ts'
import {
  buildReducedSetAndSeededResults,
  parseCacheFile,
} from './lib/form-judge-cache.ts'

function requiredArg(name: string): string {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  if (!arg) {
    console.error(`Missing required --${name}=<path> argument.`)
    process.exit(1)
  }
  return arg.slice(name.length + 3)
}

const INDEX_PATH = requiredArg('index')
const CACHE_PATH = requiredArg('cache')
const DATA_OUT = requiredArg('data-out')
const RESULTS_OUT = requiredArg('results-out')
const HASHES_OUT = requiredArg('hashes-out')

async function readCacheFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      return null
    }
    throw err
  }
}

async function main(): Promise<void> {
  const index = JSON.parse(await readFile(INDEX_PATH, 'utf8')) as IndexEntry[]
  const cache = parseCacheFile(await readCacheFile(CACHE_PATH))

  const factsById = new Map<string, SampleFile>()
  for (const entry of index) {
    if (!entry.judgeable) continue
    const facts = JSON.parse(await readFile(entry.path, 'utf8')) as SampleFile
    factsById.set(entry.id, facts)
  }

  const { combinedData, seededResultLines, hashSideFile } =
    buildReducedSetAndSeededResults(index, factsById, cache)

  await writeFile(DATA_OUT, JSON.stringify(combinedData, null, 2), 'utf8')
  await writeFile(HASHES_OUT, JSON.stringify(hashSideFile, null, 2), 'utf8')

  // Only create the results file if there's something to seed — an absent
  // file is exactly what the judge prompt already treats as "no prior
  // verdicts yet", so an empty run shouldn't create one for no reason.
  if (seededResultLines.length > 0) {
    await writeFile(RESULTS_OUT, seededResultLines.join('\n') + '\n', 'utf8')
  }

  console.log(
    `Prepared ${index.length} entries: ${seededResultLines.length} resolved without judging (skips + cache hits), ${combinedData.length} need fresh judgment.`,
  )
}

await main()
