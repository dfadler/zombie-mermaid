import { describe, it, expect } from 'vitest'
import { collectAll, sanitize, type Ctx } from '../scripts/lib/mention-watch.ts'

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))
const cfg = {
  phrases: ['zombie mermaid'],
  excludeUrlPrefixes: [],
  excludeAuthors: [],
}
const base: Omit<Ctx, 'fetch'> = {
  max: 5,
  githubDelayMs: 0,
  sleep: async () => {},
}

describe('collector edge cases', () => {
  it('sends the token on GitHub calls only, and pauses between GitHub calls', async () => {
    const seen: Record<string, string | undefined> = {}
    const slept: number[] = []
    await collectAll(
      {
        ...base,
        token: 'tok',
        githubDelayMs: 7,
        sleep: async (ms) => void slept.push(ms),
        fetch: (url, init) => {
          seen[url.split('?')[0]!] = (
            init?.headers as Record<string, string>
          )?.Authorization
          return json({})
        },
      },
      cfg,
    )
    expect(seen['https://api.github.com/search/code']).toBe('Bearer tok')
    expect(seen['https://api.github.com/graphql']).toBe('Bearer tok')
    expect(seen['https://registry.npmjs.org/-/v1/search']).toBeUndefined()
    expect(slept).toEqual([7, 7, 7, 7])
  })

  it('omits the auth header without a token', async () => {
    let auth: unknown = 'unset'
    await collectAll(
      {
        ...base,
        fetch: (url, init) => {
          if (url.includes('search/code'))
            auth = (init?.headers as Record<string, string>).Authorization
          return json({})
        },
      },
      cfg,
    )
    expect(auth).toBeUndefined()
  })

  it('handles sparse payloads: missing fields, descriptions, GraphQL errors', async () => {
    const fetch: Ctx['fetch'] = (url) => {
      if (url.includes('search/code'))
        return json({ items: [{ html_url: 'https://github.com/o/r/a' }, {}] })
      if (url.includes('search/repositories'))
        return json({
          items: [
            {
              html_url: 'https://github.com/o/with',
              full_name: 'o/with',
              description: 'zombie-mermaid thing',
            },
            {
              html_url: 'https://github.com/o/zombie-mermaid',
              full_name: 'o/zombie-mermaid',
            },
          ],
        })
      if (url.includes('graphql')) return json({ errors: [{ message: 'x' }] })
      if (url.includes('registry.npmjs.org'))
        return json({
          objects: [
            {
              package: {
                name: 'zombie-mermaid-a',
                publisher: { username: 'pub' },
              },
            },
            {
              package: {
                name: 'b',
                description: 'zombie mermaid',
                keywords: ['x'],
              },
            },
          ],
        })
      return json({
        hits: [
          {
            objectID: '1',
            story_title: 'Some story',
            comment_text: 'zombie mermaid',
          },
          { objectID: '2', comment_text: 'zombie mermaid' },
        ],
      })
    }
    const r = await collectAll({ ...base, fetch }, cfg)
    expect(r.errors).toEqual([
      'GitHub discussions ("zombie mermaid"): GraphQL error',
    ])
    const byUrl = Object.fromEntries(r.findings.map((f) => [f.url, f]))
    expect(byUrl['https://github.com/o/r/a']!.title).toBe(
      'undefined: undefined',
    )
    expect(byUrl['https://github.com/o/with']!.title).toBe(
      'o/with - zombie-mermaid thing',
    )
    expect(byUrl['https://github.com/o/zombie-mermaid']!.title).toBe(
      'o/zombie-mermaid',
    )
    expect(
      byUrl['https://www.npmjs.com/package/zombie-mermaid-a']!.author,
    ).toBe('pub')
    expect(byUrl['https://www.npmjs.com/package/b']!.title).toBe(
      'b - zombie mermaid',
    )
    expect(byUrl['https://news.ycombinator.com/item?id=1']!.title).toBe(
      'Comment on: Some story',
    )
    expect(byUrl['https://news.ycombinator.com/item?id=2']!.title).toBe(
      'Comment on: a story',
    )
  })

  it('drops items without a URL', async () => {
    const r = await collectAll(
      {
        ...base,
        fetch: (url) =>
          url.includes('search/issues')
            ? json({ items: [{ title: 'zombie mermaid' }] })
            : json({}),
      },
      cfg,
    )
    expect(r.findings).toEqual([])
    expect(r.errors).toEqual([])
  })
})

describe('sanitize truncation', () => {
  it('cuts long text with an ellipsis', () => {
    const s = sanitize('a'.repeat(500), 10)
    expect(s).toBe('aaaaaaaaa…')
  })
  it('collapses control characters and whitespace', () => {
    expect(sanitize('a\u0000\n\t b')).toBe('a b')
  })
})
