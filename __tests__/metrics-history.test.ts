import { describe, expect, it } from 'vitest'
import {
  PACKAGES,
  appendEntry,
  collect,
  parseHistory,
  serializeHistory,
  type Fetcher,
} from '../scripts/metrics-history-append.ts'

const fixture: Fetcher = async (url) => {
  if (url.includes('api.github.com')) return { stargazers_count: 17 }
  if (url.includes('registry.npmjs.org'))
    return { version: '5.0.1', dist: { unpackedSize: 1234 } }
  return { downloads: 42 }
}

describe('metrics history', () => {
  it('collects stars, downloads and sizes from an injected fetcher', async () => {
    const e = await collect(fixture, new Date('2026-10-10T00:00:00Z'))
    expect(e.stars).toBe(17)
    expect(Object.keys(e.packages)).toEqual(PACKAGES)
    expect(e.packages['@zombie-mermaid/core']).toEqual({
      version: '5.0.1',
      unpackedSize: 1234,
      weeklyDownloads: 42,
    })
  })

  it('records null for a failed fetch instead of throwing', async () => {
    const e = await collect(async () => {
      throw new Error('offline')
    })
    expect(e.stars).toBeNull()
    expect(e.packages['zombie-mermaid']).toEqual({
      version: null,
      unpackedSize: null,
      weeklyDownloads: null,
    })
  })

  it('appends, caps and round-trips JSONL', async () => {
    const a = await collect(fixture, new Date('2026-10-01T00:00:00Z'))
    const b = await collect(fixture, new Date('2026-10-08T00:00:00Z'))
    expect(appendEntry([a], b, 1)).toEqual([b])
    expect(parseHistory(serializeHistory([a, b]))).toEqual([a, b])
  })
})
