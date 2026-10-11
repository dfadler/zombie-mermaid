/**
 * Form-judge calibration (#1609). No LLM calls here.
 *   build: tsx scripts/form-judge-calibrate.ts build --index=form-facts-index.json --data-out=calib-data.json --ids-out=calib-ids.json [--limit=N] [--sample-ids=a,b,c] [--only=dropEdge,...]
 *          Writes clean + planted-defect cases in the judge's input format; run the judge on calib-data.json (paid) separately.
 *   score: tsx scripts/form-judge-calibrate.ts score --results=calib-results.jsonl --ids=calib-ids.json  (ids file maps opaque case id -> real id)
 *          Exits 1 when FPR/recall miss the thresholds.
 */
import { readFile, writeFile } from 'node:fs/promises'
import type { IndexEntry, SampleFile } from './form-facts.ts'
import type { CombinedSample } from './lib/form-judge-cache.ts'
import {
  blindCases,
  buildCalibrationCases,
  parseLimit,
  remapVerdicts,
  scoreVerdicts,
} from './lib/form-judge-calibration.ts'

const arg = (n: string): string => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`))
  if (!a) {
    console.error(`Missing --${n}=`)
    process.exit(2)
  }
  return a.slice(n.length + 3)
}
const optArg = (n: string) =>
  process.argv.find((x) => x.startsWith(`--${n}=`))?.slice(n.length + 3)

if (process.argv[2] === 'build') {
  const index = JSON.parse(await readFile(arg('index'), 'utf8')) as IndexEntry[]
  const limit = parseLimit(optArg('limit'))
  const ids = optArg('sample-ids')?.split(',')
  const only = optArg('only')?.split(',')
  const cases: CombinedSample[] = []
  for (const e of index
    .filter((x) => x.judgeable && (!ids || ids.includes(x.id)))
    .slice(0, limit)) {
    const f = JSON.parse(await readFile(e.path, 'utf8')) as SampleFile
    if (f.trimmedSvg && f.asciiText) {
      cases.push(
        ...buildCalibrationCases({
          id: f.id,
          title: f.title,
          source: f.source,
          trimmedSvg: f.trimmedSvg,
          asciiText: f.asciiText,
        }),
      )
    }
  }
  const { blind, map } = blindCases(cases, only)
  await writeFile(arg('data-out'), JSON.stringify(blind, null, 2))
  await writeFile(arg('ids-out'), JSON.stringify(map))
  console.log(`${blind.length} calibration cases`)
} else if (process.argv[2] === 'score') {
  const lines = (await readFile(arg('results'), 'utf8')).split('\n')
  const map = JSON.parse(await readFile(arg('ids'), 'utf8')) as Record<
    string,
    string
  >
  const remapped = remapVerdicts(lines, map)
  const s = scoreVerdicts(remapped, Object.values(map))
  console.log(JSON.stringify(s, null, 2))
  process.exit(s.pass ? 0 : 1)
} else {
  console.error('usage: form-judge-calibrate.ts build|score')
  process.exit(2)
}
