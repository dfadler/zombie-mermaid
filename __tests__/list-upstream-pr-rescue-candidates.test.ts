import { describe, it, expect, vi } from 'vitest'
import {
  UPSTREAM,
  fetchRescueCandidates,
  type GhFn,
} from '../scripts/list-upstream-pr-rescue-candidates.ts'

/** Builds a canned `gh` stand-in returning one JSON response. */
function ghOnce(response: unknown): GhFn {
  return vi.fn(async () => JSON.stringify(response))
}

const NOW = new Date('2026-09-08T00:00:00Z')

describe('fetchRescueCandidates', () => {
  it('maps raw gh pr list JSON into RescueCandidate objects', async () => {
    const ghFn = ghOnce([
      {
        number: 100,
        title: 'Fix a bug',
        url: 'https://github.com/lukilabs/beautiful-mermaid/pull/100',
        createdAt: '2026-08-08T00:00:00Z', // 31 days before NOW
        isDraft: false,
        mergeable: 'MERGEABLE',
        additions: 10,
        deletions: 2,
        changedFiles: 1,
        labels: [{ name: 'bug' }],
        author: { login: 'someone', name: 'Some One' },
      },
    ])

    const candidates = await fetchRescueCandidates(100, ghFn, NOW)

    expect(candidates).toEqual([
      {
        number: 100,
        title: 'Fix a bug',
        url: 'https://github.com/lukilabs/beautiful-mermaid/pull/100',
        createdAt: '2026-08-08T00:00:00Z',
        ageDays: 31,
        author: 'someone',
        isDraft: false,
        mergeable: 'MERGEABLE',
        additions: 10,
        deletions: 2,
        changedFiles: 1,
        labels: ['bug'],
      },
    ])
  })

  it('sorts oldest first', async () => {
    const ghFn = ghOnce([
      {
        number: 1,
        title: 'Newer',
        url: 'u1',
        createdAt: '2026-09-01T00:00:00Z',
        isDraft: false,
        mergeable: 'MERGEABLE',
        additions: 1,
        deletions: 0,
        changedFiles: 1,
        labels: [],
        author: { login: 'a', name: null },
      },
      {
        number: 2,
        title: 'Older',
        url: 'u2',
        createdAt: '2026-01-01T00:00:00Z',
        isDraft: false,
        mergeable: 'MERGEABLE',
        additions: 1,
        deletions: 0,
        changedFiles: 1,
        labels: [],
        author: { login: 'b', name: null },
      },
    ])

    const candidates = await fetchRescueCandidates(100, ghFn, NOW)

    expect(candidates.map((c) => c.number)).toEqual([2, 1])
  })

  it('returns [] when upstream has no open PRs', async () => {
    const ghFn = ghOnce([])

    const candidates = await fetchRescueCandidates(100, ghFn, NOW)

    expect(candidates).toEqual([])
  })

  it('calls gh pr list against the upstream repo with the requested limit', async () => {
    const ghFn = ghOnce([])

    await fetchRescueCandidates(42, ghFn, NOW)

    const calls = (ghFn as ReturnType<typeof vi.fn>).mock.calls as [string[]][]
    const args = calls[0]![0]
    expect(args).toContain('pr')
    expect(args).toContain('list')
    expect(args).toContain(`${UPSTREAM.owner}/${UPSTREAM.name}`)
    expect(args).toContain('42')
  })
})
