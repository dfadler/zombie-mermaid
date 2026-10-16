// CLI for the weekly mentions watch (#2176); all logic is in lib/mention-watch.ts.
// Reads the seen-set, writes report.md and seen.next.json. The workflow only
// persists seen.next.json after the report issue was created, so a failed run
// never drops findings.
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
import { runWatch, type Config } from './lib/mention-watch.ts'

const config: Config = JSON.parse(
  readFileSync(new URL('./mention-watch.config.json', import.meta.url), 'utf8'),
)
const outDir = process.env.OUT_DIR ?? '.mention-watch'
const seenFile = process.env.SEEN_FILE ?? join(outDir, 'seen.json')
const seen = existsSync(seenFile)
  ? JSON.parse(readFileSync(seenFile, 'utf8'))
  : {}

const r = await runWatch({
  config,
  seen,
  date: new Date().toISOString().slice(0, 10),
  ctx: {
    fetch,
    token: process.env.GITHUB_TOKEN,
    max: config.maxPerQuery,
    githubDelayMs: 7000,
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
  },
})
if (r.allFailed) {
  console.error(`Every source failed:\n${r.errors.join('\n')}`)
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'report.md'), r.report)
writeFileSync(join(outDir, 'seen.next.json'), JSON.stringify(r.nextSeen) + '\n')
console.log(`${r.found} found, ${r.newCount} new, ${r.errors.length} errors`)
for (const e of r.errors) console.log(`  failed: ${e}`)
if (process.env.GITHUB_OUTPUT)
  appendFileSync(process.env.GITHUB_OUTPUT, `new_count=${r.newCount}\n`)
