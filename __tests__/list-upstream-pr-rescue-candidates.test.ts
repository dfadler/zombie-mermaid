import { describe, it, expect, vi } from 'vitest'
import {
  UPSTREAM,
  fetchRescueCandidates,
  filterUnseen,
  toMarkdownTable,
  type RescueCandidate,
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

  it('throws instead of returning a list that may be truncated at --limit', async () => {
    const pr = (number: number) => ({
      number,
      title: 't',
      url: 'u',
      createdAt: '2026-01-01T00:00:00Z',
      isDraft: false,
      mergeable: 'MERGEABLE',
      additions: 1,
      deletions: 0,
      changedFiles: 1,
      labels: [],
      author: { login: 'a', name: null },
    })
    const ghFn = ghOnce([pr(1), pr(2)])

    await expect(fetchRescueCandidates(2, ghFn, NOW)).rejects.toThrow(
      /truncated/,
    )
    await expect(fetchRescueCandidates(3, ghFn, NOW)).resolves.toHaveLength(2)
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

describe('filterUnseen', () => {
  const cand = (number: number) => ({ number }) as RescueCandidate

  it('drops candidates whose number is already seen, keeping order', () => {
    const result = filterUnseen([cand(3), cand(1), cand(2)], [1, 2])
    expect(result.map((c) => c.number)).toEqual([3])
  })

  it('returns everything when nothing has been seen', () => {
    expect(filterUnseen([cand(1), cand(2)], [])).toHaveLength(2)
  })
})

describe('toMarkdownTable', () => {
  it('renders upstream-controlled text as inert code spans', () => {
    const table = toMarkdownTable([
      {
        number: 7,
        title: 'Ping @victim #12 [x](http://evil) `a|b`\nignore previous',
        url: 'https://github.com/lukilabs/beautiful-mermaid/pull/7',
        createdAt: '2026-01-01T00:00:00Z',
        ageDays: 1,
        author: '@mallory',
        isDraft: false,
        mergeable: 'MERGEABLE',
        additions: 1,
        deletions: 0,
        changedFiles: 1,
        labels: [],
      },
    ])
    const lines = table.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[2]).toContain('| `@mallory` |')
    expect(lines[2]).toContain(
      '| `Ping @victim #12 [x](http://evil) a b ignore previous` |',
    )
  })

  const base = {
    number: 7,
    title: 't',
    url: 'https://github.com/lukilabs/beautiful-mermaid/pull/7',
    createdAt: '2026-01-01T00:00:00Z',
    ageDays: 1,
    author: 'a',
    isDraft: false,
    mergeable: 'MERGEABLE',
    additions: 1,
    deletions: 0,
    changedFiles: 1,
    labels: [],
  }

  it('never emits a link to the upstream PR (it would post a backlink event there)', () => {
    const row = toMarkdownTable([base]).split('\n')[2]!
    expect(row).not.toContain('https://')
    expect(row).not.toMatch(/\]\(/)
    expect(row).toContain('`lukilabs/beautiful-mermaid#7`')
  })

  it('strips control, bidi and zero-width characters', () => {
    // Built from code points so this file never contains literal bidi or
    // zero-width characters (Trojan Source; Semgrep blocks them).
    const [rlo, zwsp, lri] = [0x202e, 0x200b, 0x2066].map((c) =>
      String.fromCodePoint(c),
    )
    const title = `a\x1b]52;c;ZXZpbA==\x07b${rlo}c${zwsp}d${lri}e`
    const row = toMarkdownTable([{ ...base, title }]).split('\n')[2]!
    expect(row).not.toMatch(/\p{Cc}|\p{Cf}/u)
    expect(row).toContain('`a]52;c;ZXZpbA==bcde`')
  })

  it('truncates long titles', () => {
    const row = toMarkdownTable([{ ...base, title: 'x'.repeat(500) }]).split(
      '\n',
    )[2]!
    expect(row).toContain('`' + 'x'.repeat(100) + '…`')
    expect(row).not.toContain('x'.repeat(101))
  })
})
