import { describe, it, expect } from 'vitest'
import {
  buildReport,
  canonicalizeUrl,
  collectAll,
  COLLECTORS,
  isExcluded,
  matchesName,
  mergeSeen,
  sanitize,
  selectNew,
  type Ctx,
  type Finding,
} from '../scripts/lib/mention-watch.ts'

const f = (url: string, over: Partial<Finding> = {}): Finding => ({
  url,
  title: 't',
  source: 'npm',
  ...over,
})

describe('matchesName', () => {
  it.each([
    'Zombie Mermaid',
    'zombie-mermaid',
    'ZombieMermaid',
    'zombie_mermaid',
    'a/zombie-mermaid',
  ])('matches %s', (s) => expect(matchesName(s)).toBe(true))
  it.each(['zombie', 'mermaid', 'zombies and a mermaid'])('rejects %s', (s) =>
    expect(matchesName(s)).toBe(false),
  )
})

describe('canonicalizeUrl', () => {
  it('drops tracking params, fragment, trailing slash; keeps real params sorted', () => {
    expect(
      canonicalizeUrl('https://Example.com/a/?utm_source=x&b=2&a=1#frag'),
    ).toBe('https://example.com/a?a=1&b=2')
  })
  it('keeps root slash and passes non-URLs through', () => {
    expect(canonicalizeUrl('https://example.com/')).toBe('https://example.com/')
    expect(canonicalizeUrl(' not a url ')).toBe('not a url')
  })
})

describe('isExcluded', () => {
  const p = [
    'https://github.com/dfadler',
    'https://www.npmjs.com/package/zombie-mermaid',
  ]
  it('excludes the prefix and its subpaths only', () => {
    expect(
      isExcluded('https://github.com/dfadler/zombie-mermaid/issues/1', p),
    ).toBe(true)
    expect(isExcluded('https://github.com/dfadler', p)).toBe(true)
    expect(isExcluded('https://github.com/dfadler2/x', p)).toBe(false)
    expect(
      isExcluded('https://www.npmjs.com/package/zombie-mermaid-fork', p),
    ).toBe(false)
  })
})

describe('selectNew / mergeSeen', () => {
  it('skips seen URLs (canonical form) and respects the limit', () => {
    const seen = mergeSeen({}, [f('https://x.com/a/')], '2026-10-01')
    const out = selectNew(
      [
        f('https://x.com/a?utm_source=z'),
        f('https://x.com/b'),
        f('https://x.com/c'),
      ],
      seen,
      1,
    )
    expect(out.map((o) => o.url)).toEqual(['https://x.com/b'])
    expect(seen['https://x.com/a']).toEqual({ firstSeen: '2026-10-01' })
  })
})

describe('sanitize / buildReport', () => {
  it('neutralizes mentions, issue refs, markup and autolinks', () => {
    const s = sanitize('hi @bob see #12 <img src=x> [a](http://evil.com)')
    expect(s).not.toMatch(/@(?!​)/)
    expect(s).not.toMatch(/#(?!​)/)
    expect(s).not.toMatch(/(?<!\\)[<>[\]()]/)
    expect(s).not.toContain('http://')
  })
  it('groups by source, links each finding, lists failed sources', () => {
    const md = buildReport({
      findings: [
        f('https://a.com/x(1)', { title: 'A', date: '2026-10-01T00:00:00Z' }),
        f('https://b.com', { source: 'Hacker News' }),
      ],
      date: '2026-10-16',
      errors: ['npm ("x"): HTTP 500'],
    })
    expect(md).toContain('# Mentions report: 2026-10-16')
    expect(md).toContain('## npm (1)')
    expect(md).toContain('## Hacker News (1)')
    expect(md).toContain('[A](https://a.com/x%281%29) (2026-10-01)')
    expect(md).toContain('## Sources that failed this run')
  })
})

describe('collectAll', () => {
  const json = (body: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }))
  const ctx = (fetch: Ctx['fetch']): Ctx => ({
    fetch,
    max: 5,
    githubDelayMs: 0,
    sleep: async () => {},
  })
  const cfg = {
    phrases: ['zombie mermaid'],
    excludeUrlPrefixes: ['https://github.com/dfadler'],
  }

  it('parses each source, filters non-matches and excluded URLs, dedupes, records failures', async () => {
    const fetch: Ctx['fetch'] = (url) => {
      if (url.includes('search/code'))
        return json({
          items: [
            {
              html_url: 'https://github.com/o/r/blob/m/a.md',
              path: 'a.md',
              repository: { full_name: 'o/r' },
            },
            {
              html_url: 'https://github.com/dfadler/zombie-mermaid/blob/m/x.md',
              path: 'x.md',
              repository: { full_name: 'dfadler/zombie-mermaid' },
            },
          ],
        })
      if (url.includes('search/issues'))
        return json({
          items: [
            {
              html_url: 'https://github.com/o/r/issues/1',
              title: 'uses zombie-mermaid',
              body: null,
              created_at: '2026-10-01T00:00:00Z',
            },
            {
              html_url: 'https://github.com/o/r/issues/2',
              title: 'unrelated',
              body: 'nope',
            },
          ],
        })
      if (url.includes('search/repositories'))
        return json({ message: 'nope' }, 403)
      if (url.includes('graphql'))
        return json({
          data: {
            search: {
              nodes: [
                {
                  url: 'https://github.com/o/r/discussions/3',
                  title: 'ZombieMermaid?',
                  body: '',
                },
                {},
              ],
            },
          },
        })
      if (url.includes('registry.npmjs.org'))
        return json({
          objects: [
            {
              package: {
                name: 'zm-fork',
                description: 'a zombie-mermaid fork',
                keywords: ['k'],
                links: { npm: 'https://www.npmjs.com/package/zm-fork' },
              },
            },
          ],
        })
      return json({
        hits: [
          { objectID: '9', title: 'Show HN: Zombie Mermaid' },
          {
            objectID: '10',
            story_title: 'Other',
            comment_text: 'try zombie_mermaid',
          },
          { objectID: '11', title: 'zombie mermaid', url: 'x' },
        ],
      })
    }
    const r = await collectAll(ctx(fetch), cfg)
    expect(r.findings.map((x) => x.url)).toEqual([
      'https://github.com/o/r/blob/m/a.md',
      'https://github.com/o/r/issues/1',
      'https://github.com/o/r/discussions/3',
      'https://www.npmjs.com/package/zm-fork',
      'https://news.ycombinator.com/item?id=9',
      'https://news.ycombinator.com/item?id=10',
      'https://news.ycombinator.com/item?id=11',
    ])
    expect(r.errors).toEqual([
      'GitHub repositories ("zombie mermaid"): HTTP 403',
    ])
    expect(r.attempts).toBe(COLLECTORS.length)
  })

  it('treats a thrown fetch as a per-source error, not a crash', async () => {
    const r = await collectAll(
      ctx(() => Promise.reject(new Error('boom'))),
      cfg,
    )
    expect(r.findings).toEqual([])
    expect(r.errors).toHaveLength(COLLECTORS.length)
  })
})
