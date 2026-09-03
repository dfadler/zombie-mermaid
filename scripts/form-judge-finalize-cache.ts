/**
 * Derives the updated verdict cache for one category after its judge step
 * has run (or been skipped, if scripts/form-judge-prepare.ts found nothing
 * to judge), purely from whatever ended up in the final results file.
 *
 * Safe by construction: a sample whose verdict never got written (e.g. a
 * timeout mid-batch) is simply absent from the final results file, so
 * scripts/lib/form-judge-cache.ts's finalizeCache correctly excludes it
 * from the updated cache too — next run retries it as an ordinary cache
 * miss, never a false "already checked".
 *
 * Usage: tsx scripts/form-judge-finalize-cache.ts \
 *   --results=form-judge-results-<slug>.jsonl \
 *   --hashes=form-judge-hashes-<slug>.json \
 *   --cache-out=.form-judge-cache/<slug>.json
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { finalizeCache } from './lib/form-judge-cache.ts'

function requiredArg(name: string): string {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  if (!arg) {
    console.error(`Missing required --${name}=<path> argument.`)
    process.exit(1)
  }
  return arg.slice(name.length + 3)
}

const RESULTS_PATH = requiredArg('results')
const HASHES_PATH = requiredArg('hashes')
const CACHE_OUT = requiredArg('cache-out')

async function readOptional(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8')
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      return ''
    }
    throw err
  }
}

async function main(): Promise<void> {
  const resultsRaw = await readOptional(RESULTS_PATH)
  const finalResultsLines = resultsRaw
    .split('\n')
    .filter((l) => l.trim() !== '')
  const hashSideFile = JSON.parse(
    await readFile(HASHES_PATH, 'utf8'),
  ) as Record<string, string>

  const cache = finalizeCache(finalResultsLines, hashSideFile)

  await mkdir(dirname(CACHE_OUT), { recursive: true })
  await writeFile(CACHE_OUT, JSON.stringify(cache, null, 2), 'utf8')

  console.log(
    `Cached ${Object.keys(cache).length} verdict(s) of ${finalResultsLines.length} result line(s) for next run.`,
  )
}

await main()
