// CLI for the weekly mentions watch (#2176). Reads the seen-set, collects
// mentions, and writes the report plus the *next* seen-set. The workflow only
// persists seen.next.json after the report issue was created, so a failed
// run never drops findings.
//
//   env: GITHUB_TOKEN, SEEN_FILE (default .mention-watch/seen.json),
//        OUT_DIR (default .mention-watch), GITHUB_OUTPUT (optional)
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import {
  buildReport,
  collectAll,
  mergeSeen,
  selectNew,
  type Config,
  type SeenSet,
} from './lib/mention-watch.ts'

const config: Config = JSON.parse(
  readFileSync(new URL('./mention-watch.config.json', import.meta.url), 'utf8'),
)
const outDir = process.env.OUT_DIR ?? '.mention-watch'
const seenFile = process.env.SEEN_FILE ?? join(outDir, 'seen.json')
const seen: SeenSet = existsSync(seenFile)
  ? JSON.parse(readFileSync(seenFile, 'utf8'))
  : {}
const date = new Date().toISOString().slice(0, 10)

const { findings, errors, attempts } = await collectAll(
  {
    fetch,
    token: process.env.GITHUB_TOKEN,
    max: config.maxPerQuery,
    githubDelayMs: 7000,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  },
  config,
)

if (attempts > 0 && errors.length === attempts) {
  console.error(`Every source failed:\n${errors.join('\n')}`)
  process.exit(1)
}

const fresh = selectNew(findings, seen, config.maxReported)
mkdirSync(outDir, { recursive: true })
writeFileSync(
  join(outDir, 'report.md'),
  buildReport({ findings: fresh, date, errors }),
)
writeFileSync(
  join(outDir, 'seen.next.json'),
  JSON.stringify(mergeSeen(seen, fresh, date), null, 2) + '\n',
)

console.log(
  `${findings.length} found, ${fresh.length} new, ${errors.length} source error(s)`,
)
for (const e of errors) console.log(`  failed: ${e}`)
if (process.env.GITHUB_OUTPUT)
  appendFileSync(process.env.GITHUB_OUTPUT, `new_count=${fresh.length}\n`)
