import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  appendEntry,
  readHistory,
  serializeHistory,
  type BenchHistoryEntry,
} from '../scripts/bench-history-append.ts'
import {
  combinedTotal,
  parseHistory,
  sparkline,
} from '../scripts/bench-trend.ts'

function entry(overrides: Partial<BenchHistoryEntry> = {}): BenchHistoryEntry {
  return {
    generatedAt: '2026-09-01T00:00:00.000Z',
    sampleCount: 10,
    svgTotalMs: 100,
    asciiTotalMs: 20,
    categories: {
      Flowchart: { sampleCount: 10, svgMs: 100, asciiMs: 20 },
    },
    commit: 'abc1234',
    ref: 'refs/heads/main',
    ...overrides,
  }
}

describe('readHistory', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'bench-history-test-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('returns an empty array when the file does not exist yet', async () => {
    const result = await readHistory(join(dir, 'missing.jsonl'))
    expect(result).toEqual([])
  })

  it('parses one JSON object per line, skipping blank lines', async () => {
    const { writeFile } = await import('node:fs/promises')
    const path = join(dir, 'history.jsonl')
    const e1 = entry({ commit: 'aaa1111' })
    const e2 = entry({ commit: 'bbb2222' })
    await writeFile(path, `${JSON.stringify(e1)}\n\n${JSON.stringify(e2)}\n`)

    const result = await readHistory(path)
    expect(result).toEqual([e1, e2])
  })
})

describe('appendEntry', () => {
  it('appends to an empty history', () => {
    const e = entry()
    expect(appendEntry([], e, 520)).toEqual([e])
  })

  it('appends after existing entries without reordering them', () => {
    const e1 = entry({ commit: 'aaa1111' })
    const e2 = entry({ commit: 'bbb2222' })
    expect(appendEntry([e1], e2, 520)).toEqual([e1, e2])
  })

  it('drops the oldest entries once the cap is exceeded', () => {
    const existing = [
      entry({ commit: 'c1' }),
      entry({ commit: 'c2' }),
      entry({ commit: 'c3' }),
    ]
    const next = entry({ commit: 'c4' })

    const result = appendEntry(existing, next, 3)

    expect(result.map((r) => r.commit)).toEqual(['c2', 'c3', 'c4'])
  })

  it('never exceeds maxEntries even by more than one append at a time', () => {
    // Sabotage check: a naive `entries.slice(-maxEntries + 1)` (off-by-one)
    // would let the array grow unbounded relative to the intended cap over
    // many appends. Confirm the cap holds exactly.
    let history: BenchHistoryEntry[] = []
    for (let i = 0; i < 10; i++) {
      history = appendEntry(history, entry({ commit: `c${i}` }), 3)
    }
    expect(history).toHaveLength(3)
    expect(history.map((r) => r.commit)).toEqual(['c7', 'c8', 'c9'])
  })
})

describe('serializeHistory / parseHistory round-trip', () => {
  it('round-trips a list of entries through serialize -> parse', () => {
    const entries = [entry({ commit: 'aaa1111' }), entry({ commit: 'bbb2222' })]
    const serialized = serializeHistory(entries)
    expect(parseHistory(serialized)).toEqual(entries)
  })

  it('serializes an empty list to an empty string', () => {
    expect(serializeHistory([])).toBe('')
    expect(parseHistory('')).toEqual([])
  })
})

describe('combinedTotal', () => {
  it('sums svgTotalMs and asciiTotalMs', () => {
    expect(combinedTotal(entry({ svgTotalMs: 100, asciiTotalMs: 20 }))).toBe(
      120,
    )
  })
})

describe('sparkline', () => {
  it('returns an empty string for no values', () => {
    expect(sparkline([])).toBe('')
  })

  it('renders the lowest block for a flat series', () => {
    expect(sparkline([5, 5, 5])).toBe('▁▁▁')
  })

  it('scales min to the lowest block and max to the highest', () => {
    const result = sparkline([0, 50, 100])
    expect(result[0]).toBe('▁')
    expect(result[2]).toBe('█')
    expect(result).toHaveLength(3)
  })
})
