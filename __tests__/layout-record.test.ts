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

  it('records a sequence line and section, and works without a history file', async () => {
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
    const runs: ScorecardRun[] = [{ entry: summarize(results, meta), results }]
    const seq = {
      kind: 'sequence' as const,
      date: '2026-10-30',
      commit: 'abc',
      mermaid: '12.2.0',
      samples: 21,
      participants: 1,
      messages: 1,
      direction: 1,
    }
    await writeFile(history, '')
    await writeRecords({ history, scorecard }, runs, undefined, seq)
    expect(await readFile(scorecard, 'utf8')).toContain('Sequence diagrams')
    await writeRecords({ scorecard }, runs, undefined, seq)
    expect(await readFile(scorecard, 'utf8')).toContain('Sequence diagrams')
  })

  it('records a pie line and section, with and without a history file', async () => {
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
    const runs: ScorecardRun[] = [{ entry: summarize(results, meta), results }]
    const pie = {
      kind: 'pie' as const,
      date: '2026-10-30',
      commit: 'abc',
      mermaid: '12.2.0',
      samples: 19,
      angles: 1,
      labels: 1,
      legend: 1,
    }
    await writeFile(history, '')
    await writeRecords({ history, scorecard }, runs, undefined, undefined, pie)
    expect(await readFile(history, 'utf8')).toContain('"kind":"pie"')
    expect(await readFile(scorecard, 'utf8')).toContain('Pie charts')
    await writeRecords({ scorecard }, runs, undefined, undefined, pie)
    expect(await readFile(scorecard, 'utf8')).toContain('Pie charts')
  })

  it('writes nothing when neither file is requested', async () => {
    await expect(writeRecords({}, [], undefined)).resolves.toBeUndefined()
  })
})
