import { describe, it, expect } from 'vitest'
import {
  buildReport,
  canonicalizeUrl,
  collectAll,
  COLLECTORS,
  isExcluded,
  matchesName,
  mergeSeen,
  runWatch,
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
    excludeAuthors: ['dfadler'],
  }

  it('drops findings authored by an excluded login, whatever repo they are in', async () => {
    const fetch: Ctx['fetch'] = (url) =>
      url.includes('search/issues')
        ? json({
            items: [
              {
                html_url: 'https://github.com/o/r/issues/1',
                title: 'zombie-mermaid',
                user: { login: 'DFadler' },
              },
              {
                html_url: 'https://github.com/o/r/issues/2',
                title: 'zombie-mermaid',
                user: { login: 'someone' },
              },
            ],
          })
        : json({})
    const r = await collectAll(ctx(fetch), cfg)
    expect(r.findings.map((x) => [x.url, x.author])).toEqual([
      ['https://github.com/o/r/issues/2', 'someone'],
    ])
  })

  it('runWatch skips already-seen URLs, flags a total outage, and reports authors', async () => {
    const config = { ...cfg, maxPerQuery: 5, maxReported: 10 }
    const hn = (url: string) =>
      url.includes('algolia')
        ? json({
            hits: [
              { objectID: '1', title: 'zombie mermaid', author: 'pg' },
              { objectID: '2', title: 'zombie mermaid' },
            ],
          })
        : json({})
    const seen = {
      'https://news.ycombinator.com/item?id=2': { firstSeen: '2026-10-01' },
    }
    const r = await runWatch({ config, seen, date: '2026-10-16', ctx: ctx(hn) })
    expect(r.newCount).toBe(1)
    expect(r.allFailed).toBe(false)
    expect(r.report).toContain('by pg')
    expect(Object.keys(r.nextSeen).sort()).toEqual([
      'https://news.ycombinator.com/item?id=1',
      'https://news.ycombinator.com/item?id=2',
    ])
    const down = await runWatch({
      config,
      seen: {},
      date: '2026-10-16',
      ctx: ctx(() => json({}, 500)),
    })
    expect(down.allFailed).toBe(true)
  })

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
    expect(r.attempts).toBe(COLLECTORS.filter((c) => !c.needsTavilyKey).length)
  })

  it('treats a thrown fetch as a per-source error, not a crash', async () => {
    const r = await collectAll(
      ctx(() => Promise.reject(new Error('boom'))),
      cfg,
    )
    expect(r.findings).toEqual([])
    expect(r.errors).toHaveLength(
      COLLECTORS.filter((c) => !c.needsTavilyKey).length,
    )
  })

  describe('Web source (Tavily, #2201)', () => {
    const web = (url: string, init?: RequestInit) => {
      if (url !== 'https://api.tavily.com/search') return json({}, 500)
      expect(init?.method).toBe('POST')
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer k')
      expect(JSON.parse(String(init?.body))).toMatchObject({
        query: '"zombie mermaid"',
        max_results: 5,
      })
      return json({
        results: [
          {
            url: 'https://blog.example.com/post',
            title: 'Trying zombie-mermaid',
            content: 'a review',
            published_date: '2026-10-01',
          },
          { url: 'https://dev.to/x', title: 'Unrelated', content: 'no' },
          { url: 'https://github.com/o/r', title: 'zombie-mermaid' },
          { url: 'https://www.npmjs.com/package/x', title: 'zombie-mermaid' },
          { url: 'https://dfadler.dev/zm', title: 'zombie-mermaid' },
          { title: 'zombie-mermaid', content: 'no url' },
          { url: 'not a url', title: 'zombie-mermaid' },
          { url: 'https://forum.example.com/t/1', content: 'zombie-mermaid' },
        ],
      })
    }
    const only = COLLECTORS.filter((c) => c.source === 'Web')
    const withKey = { ...ctx(web), tavilyKey: 'k' }

    it('reports matching pages, dropping non-matches, covered hosts, excluded and bad URLs', async () => {
      const r = await collectAll(
        withKey,
        { ...cfg, excludeUrlPrefixes: ['https://dfadler.dev'] },
        only,
      )
      expect(r.findings.map((x) => [x.url, x.title, x.source, x.date])).toEqual(
        [
          [
            'https://blog.example.com/post',
            'Trying zombie-mermaid',
            'Web',
            '2026-10-01',
          ],
          [
            'https://forum.example.com/t/1',
            'https://forum.example.com/t/1',
            'Web',
            undefined,
          ],
        ],
      )
      expect(r.errors).toEqual([])
    })

    it('is skipped without a key: no fetch, no attempt, no error', async () => {
      let calls = 0
      const r = await collectAll(
        ctx(() => {
          calls++
          return json({})
        }),
        cfg,
        only,
      )
      expect(calls).toBe(0)
      expect(r).toEqual({ findings: [], errors: [], attempts: 0 })
    })

    it('records an HTTP error and treats an empty result as nothing found', async () => {
      const bad = await collectAll(
        { ...ctx(() => json({}, 429)), tavilyKey: 'k' },
        cfg,
        only,
      )
      expect(bad.errors).toEqual(['Web ("zombie mermaid"): HTTP 429'])
      const empty = await collectAll(
        { ...ctx(() => json({})), tavilyKey: 'k' },
        cfg,
        only,
      )
      expect(empty.findings).toEqual([])
      expect(empty.errors).toEqual([])
    })
  })
})
