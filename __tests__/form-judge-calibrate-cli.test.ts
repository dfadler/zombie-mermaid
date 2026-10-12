import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const asciiText =
  '┌───────┐\n│ Start │\n└───────┘\n    │\n    ▼\n┌────────┐\n│ Finish │\n└────────┘'

const run = (...args: string[]) =>
  spawnSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/form-judge-calibrate.ts', ...args],
    { encoding: 'utf8' },
  )

describe('form-judge-calibrate CLI', () => {
  it('builds blinded cases, scores verdicts, and rejects a bad --limit', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fjc-'))
    try {
      const sample = join(dir, 'x.json')
      await writeFile(
        sample,
        JSON.stringify({
          id: 'x',
          title: 'X',
          source: 'graph TD\n Start --> Finish',
          trimmedSvg: '<g/>',
          asciiText,
        }),
      )
      const index = join(dir, 'index.json')
      await writeFile(
        index,
        JSON.stringify([{ id: 'x', path: sample, judgeable: true }]),
      )
      const data = join(dir, 'data.json')
      const ids = join(dir, 'ids.json')
      const out = [`--data-out=${data}`, `--ids-out=${ids}`]
      const built = run('build', `--index=${index}`, ...out)
      expect(built.stdout).toContain('6 calibration cases')
      const map = JSON.parse(await readFile(ids, 'utf8')) as Record<
        string,
        string
      >
      expect(Object.values(map)).toContain('x__dropEdge')

      const results = join(dir, 'results.jsonl')
      const verdicts = Object.entries(map).map(([id, real]) =>
        JSON.stringify({ id, faithful: real.endsWith('__clean') }),
      )
      await writeFile(results, verdicts.join('\n'))
      const scored = run('score', `--results=${results}`, `--ids=${ids}`)
      expect(scored.status).toBe(0)
      expect(JSON.parse(scored.stdout)).toMatchObject({ fpr: 0, recall: 1 })

      const bad = run('build', `--index=${index}`, ...out, '--limit=abc')
      expect(bad.status).not.toBe(0)
      expect(bad.stderr).toContain('--limit must be a non-negative integer')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }, 30_000)
})
