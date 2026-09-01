import { describe, it, expect, vi } from 'vitest'
import {
  FORK,
  UPSTREAM,
  fetchRepoStats,
  fetchRescuedIssues,
  fetchResponseTimeStats,
  type GhFn,
} from '../scripts/generate-dashboard-data.ts'
import type { ForkFix } from '../demo/fork-fixes-data.ts'

/** Builds a canned `gh` stand-in from an ordered list of JSON responses. */
function ghSequence(responses: unknown[]): GhFn {
  let i = 0
  return vi.fn(async () => {
    if (i >= responses.length) {
      throw new Error(`ghSequence: no response queued for call #${i}`)
    }
    return JSON.stringify(responses[i++])
  })
}

describe('fetchRepoStats', () => {
  it('combines repo info, search counts, and releases into one RepoStats', async () => {
    const ghFn = ghSequence([
      { pushed_at: '2026-08-01T00:00:00Z', open_issues_count: 99 },
      { total_count: 3 }, // open issues (search)
      { total_count: 2 }, // open PRs
      { total_count: 41 }, // merged PRs
      [
        { tag_name: 'v1.2.0', published_at: '2026-07-15T00:00:00Z' },
        { tag_name: 'v1.1.0', published_at: '2026-06-01T00:00:00Z' },
      ],
    ])

    const stats = await fetchRepoStats(FORK, ghFn)

    expect(stats).toEqual({
      owner: 'dfadler',
      name: 'zombie-mermaid',
      url: 'https://github.com/dfadler/zombie-mermaid',
      lastPushedAt: '2026-08-01T00:00:00Z',
      openIssues: 3,
      openPRs: 2,
      mergedPRs: 41,
      releaseCount: 2,
      latestRelease: { tag: 'v1.2.0', publishedAt: '2026-07-15T00:00:00Z' },
    })
  })

  it('sets latestRelease to null when the repo has no releases', async () => {
    const ghFn = ghSequence([
      { pushed_at: '2026-08-01T00:00:00Z', open_issues_count: 0 },
      { total_count: 0 },
      { total_count: 0 },
      { total_count: 0 },
      [],
    ])

    const stats = await fetchRepoStats(UPSTREAM, ghFn)

    expect(stats.releaseCount).toBe(0)
    expect(stats.latestRelease).toBeNull()
  })

  it('issues the four search/release calls in parallel against the given repo slug', async () => {
    const ghFn = ghSequence([
      { pushed_at: '2026-08-01T00:00:00Z', open_issues_count: 0 },
      { total_count: 0 },
      { total_count: 0 },
      { total_count: 0 },
      [],
    ])

    await fetchRepoStats({ owner: 'acme', name: 'widgets' }, ghFn)

    const calls = (ghFn as ReturnType<typeof vi.fn>).mock.calls as [string[]][]
    expect(calls[0]![0]).toContain('repos/acme/widgets')
    expect(calls[1]![0].join(' ')).toContain(
      'repo:acme/widgets is:issue is:open',
    )
    expect(calls[2]![0].join(' ')).toContain('repo:acme/widgets is:pr is:open')
    expect(calls[3]![0].join(' ')).toContain(
      'repo:acme/widgets is:pr is:merged',
    )
    expect(calls[4]![0][0]).toBe('api')
    expect(calls[4]![0][1]).toBe('repos/acme/widgets/releases')
  })
})

describe('fetchRescuedIssues', () => {
  const fixA: ForkFix = {
    id: 'fix-a',
    title: 'Fix A',
    symptom: 'broke',
    source: 'flowchart TD',
    fixCommit: 'abc123',
    pr: 100,
    render: 'svg',
    lookFor: 'the thing',
    upstreamIssues: [10],
  }
  const fixB: ForkFix = {
    id: 'fix-b',
    title: 'Fix B',
    symptom: 'also broke',
    source: 'flowchart TD',
    fixCommit: 'def456',
    pr: 101,
    render: 'svg',
    lookFor: 'the other thing',
    upstreamIssues: [10, 20],
  }

  it('returns [] without calling gh when no fix references an upstream issue', async () => {
    const ghFn = vi.fn()
    const noRefs: ForkFix = { ...fixA, upstreamIssues: undefined }

    const result = await fetchRescuedIssues([noRefs], ghFn)

    expect(result).toEqual([])
    expect(ghFn).not.toHaveBeenCalled()
  })

  it('dedupes an upstream issue shared by two fixes, keeping the first', async () => {
    const ghFn = ghSequence([
      {
        data: {
          repository: {
            i10: { number: 10, state: 'OPEN' },
            i20: { number: 20, state: 'CLOSED' },
          },
        },
      },
    ])

    const result = await fetchRescuedIssues([fixA, fixB], ghFn)

    expect(result).toEqual(
      expect.arrayContaining([
        {
          number: 10,
          state: 'open',
          fixId: 'fix-a',
          fixTitle: 'Fix A',
          forkPr: 100,
        },
        {
          number: 20,
          state: 'closed',
          fixId: 'fix-b',
          fixTitle: 'Fix B',
          forkPr: 101,
        },
      ]),
    )
    expect(result).toHaveLength(2)
  })

  it('maps GraphQL OPEN/CLOSED to the lowercase open/closed union', async () => {
    const ghFn = ghSequence([
      { data: { repository: { i10: { number: 10, state: 'CLOSED' } } } },
    ])

    const result = await fetchRescuedIssues([fixA], ghFn)

    expect(result[0]!.state).toBe('closed')
  })
})

describe('fetchResponseTimeStats', () => {
  it('returns null when no search results have a first comment', async () => {
    const ghFn = ghSequence([{ items: [] }])

    const result = await fetchResponseTimeStats(20, ghFn)

    expect(result).toBeNull()
  })

  it("excludes the issue author's own follow-up from the response calculation", async () => {
    const ghFn = ghSequence([
      {
        items: [
          {
            number: 1,
            created_at: '2026-01-01T00:00:00Z',
            comments: 2,
            user: { login: 'author' },
          },
        ],
      },
      [
        { created_at: '2026-01-01T01:00:00Z', user: { login: 'author' } },
        { created_at: '2026-01-01T05:00:00Z', user: { login: 'someone-else' } },
      ],
    ])

    const result = await fetchResponseTimeStats(20, ghFn)

    expect(result).toEqual({
      sampleSize: 1,
      medianHours: 5,
      note: expect.stringContaining('Median time from issue open'),
    })
  })

  it('skips an issue whose only comments are all from the author', async () => {
    const ghFn = ghSequence([
      {
        items: [
          {
            number: 1,
            created_at: '2026-01-01T00:00:00Z',
            comments: 1,
            user: { login: 'author' },
          },
        ],
      },
      [{ created_at: '2026-01-01T01:00:00Z', user: { login: 'author' } }],
    ])

    const result = await fetchResponseTimeStats(20, ghFn)

    expect(result).toBeNull()
  })

  it('computes the median across an odd number of samples (middle value)', async () => {
    const ghFn = ghSequence([
      {
        items: [
          {
            number: 1,
            created_at: '2026-01-01T00:00:00Z',
            comments: 1,
            user: { login: 'a' },
          },
          {
            number: 2,
            created_at: '2026-01-01T00:00:00Z',
            comments: 1,
            user: { login: 'a' },
          },
          {
            number: 3,
            created_at: '2026-01-01T00:00:00Z',
            comments: 1,
            user: { login: 'a' },
          },
        ],
      },
      [{ created_at: '2026-01-01T01:00:00Z', user: { login: 'b' } }], // 1h
      [{ created_at: '2026-01-01T10:00:00Z', user: { login: 'b' } }], // 10h
      [{ created_at: '2026-01-01T04:00:00Z', user: { login: 'b' } }], // 4h
    ])

    const result = await fetchResponseTimeStats(20, ghFn)

    // sorted: [1, 4, 10] -> median is the middle value, 4
    expect(result!.medianHours).toBe(4)
    expect(result!.sampleSize).toBe(3)
  })

  it('computes the median across an even number of samples (average of the two middle values)', async () => {
    const ghFn = ghSequence([
      {
        items: [
          {
            number: 1,
            created_at: '2026-01-01T00:00:00Z',
            comments: 1,
            user: { login: 'a' },
          },
          {
            number: 2,
            created_at: '2026-01-01T00:00:00Z',
            comments: 1,
            user: { login: 'a' },
          },
        ],
      },
      [{ created_at: '2026-01-01T02:00:00Z', user: { login: 'b' } }], // 2h
      [{ created_at: '2026-01-01T06:00:00Z', user: { login: 'b' } }], // 6h
    ])

    const result = await fetchResponseTimeStats(20, ghFn)

    // sorted: [2, 6] -> average of both middle values, 4
    expect(result!.medianHours).toBe(4)
    expect(result!.sampleSize).toBe(2)
  })

  it('rounds medianHours to one decimal place', async () => {
    const ghFn = ghSequence([
      {
        items: [
          {
            number: 1,
            created_at: '2026-01-01T00:00:00Z',
            comments: 1,
            user: { login: 'a' },
          },
        ],
      },
      [{ created_at: '2026-01-01T01:40:00Z', user: { login: 'b' } }], // 1h40m = 1.6666...h
    ])

    const result = await fetchResponseTimeStats(20, ghFn)

    expect(result!.medianHours).toBe(1.7)
  })

  it('drops a sample where the first non-author comment predates the issue (negative diff)', async () => {
    const ghFn = ghSequence([
      {
        items: [
          {
            number: 1,
            created_at: '2026-01-02T00:00:00Z',
            comments: 1,
            user: { login: 'a' },
          },
        ],
      },
      [{ created_at: '2026-01-01T00:00:00Z', user: { login: 'b' } }],
    ])

    const result = await fetchResponseTimeStats(20, ghFn)

    expect(result).toBeNull()
  })
})
