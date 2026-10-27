import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { writeRecords } from '../scripts/lib/layout-record.ts'
import {
  summarize,
  type ScorecardRun,
} from '../scripts/lib/layout-agreement.ts'

const meta = {
  date: '2026-10-27',
  commit: 'abc',
  mermaid: '12.2.0',
  type: 'flowchart' as const,
}
const label = {
  kind: 'label' as const,
  date: '2026-10-27',
  commit: 'abc',
  mermaid: '12.2.0',
  cases: 4,
  officialAlong: 0.5,
  asciiAlong: 0.53,
  meanAbsDelta: 0.06,
}

describe('writeRecords', () => {
  it('appends history and label lines, then rebuilds the scorecard from the file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'layout-record-'))
    const history = join(dir, 'h.jsonl')
    const scorecard = join(dir, 's.md')
    const results = {
      a: {
        vertical: 1,
        horizontal: 1,
        containment: 1,
        nodes: 3,
        subgraphs: false,
      },
    }
    const entry = summarize(results, meta)
    const runs: ScorecardRun[] = [{ entry, results }]
    await writeFile(history, '')
    await writeRecords({ history, scorecard }, runs, label)
    const lines = (await readFile(history, 'utf8'))
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l))
    expect(lines.map((l) => l.kind ?? 'type')).toEqual(['type', 'label'])
    expect(await readFile(scorecard, 'utf8')).toContain('Edge labels')
  })

  it('writes nothing when neither file is requested', async () => {
    await expect(writeRecords({}, [], undefined)).resolves.toBeUndefined()
  })
})
