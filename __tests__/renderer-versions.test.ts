import { describe, expect, it } from 'vitest'
import {
  drawVersion,
  githubBundlePath,
  liveChunkPaths,
} from '../scripts/lib/renderer-versions.ts'

describe('renderer-versions parsers (#2830)', () => {
  it('reads the renderer.draw version literal in both quoting styles', () => {
    expect(drawVersion('x;renderer.draw(e,t,"12.2.0",C)')).toBe('12.2.0')
    expect(drawVersion('renderer.draw(n,e,`12.3.0`,y)')).toBe('12.3.0')
  })

  it('returns undefined, not a guess, when the literal is gone', () => {
    expect(drawVersion('renderer.draw(e,t,version,C)')).toBeUndefined()
    expect(drawVersion('version:"0.0.0"')).toBeUndefined()
  })

  it('finds the GitHub bundle path and the mermaid.live chunks', () => {
    expect(
      githubBundlePath('<script src="/static/assets/mermaidMarkdown-5b99.js">'),
    ).toBe('/static/assets/mermaidMarkdown-5b99.js')
    expect(githubBundlePath('<html>')).toBeUndefined()
    expect(
      liveChunkPaths(
        '<a href="/_app/immutable/a.js"><b src="/_app/immutable/a.js">',
      ),
    ).toEqual(['/_app/immutable/a.js'])
  })
})

import {
  githubVersion,
  liveVersion,
  run,
} from '../scripts/lib/renderer-versions.ts'

const fake =
  (ghVer: string | null, liveVer: string | null, status = 200) =>
  async (url: string): Promise<Response> => {
    const body = (b: string) => new Response(b, { status })
    if (url.includes('viewscreen') && url.includes('/markdown/'))
      return body('<script src="/static/assets/mermaidMarkdown-ab12.js">')
    if (url.endsWith('mermaidMarkdown-ab12.js'))
      return body(ghVer ? `renderer.draw(e,t,"${ghVer}",C)` : 'nothing')
    if (url === 'https://mermaid.live/')
      return body(
        '<a href="/_app/immutable/a.js"><a href="/_app/immutable/b.js">',
      )
    if (url.endsWith('a.js')) return new Response('', { status: 500 })
    return body(liveVer ? `renderer.draw(n,e,\`${liveVer}\`,y)` : 'nothing')
  }
const rec = { GitHub: '12.2.0', 'mermaid.live': '12.3.0' }

describe('run (#2830)', () => {
  it('reads both surfaces', async () => {
    expect(await githubVersion(fake('12.2.0', null))).toEqual({
      version: '12.2.0',
      bundle: '/static/assets/mermaidMarkdown-ab12.js',
    })
    expect(await liveVersion(fake(null, '12.3.0'))).toBe('12.3.0')
  })

  it('fails when the GitHub iframe has no bundle', async () => {
    const get = async () => new Response('<html>')
    await expect(githubVersion(get)).rejects.toThrow(/no mermaidMarkdown/)
  })

  it('exits 0 when nothing moved', async () => {
    const r = await run(fake('12.2.0', '12.3.0'), rec, '12.3.0')
    expect(r.code).toBe(0)
    expect(r.lines[0]).toMatch(/^ok +GitHub 12.2.0/)
  })

  it('exits 1 and names the move', async () => {
    const r = await run(fake('12.3.0', '12.3.0'), rec, '12.3.0')
    expect(r.code).toBe(1)
    expect(r.lines.join('\n')).toMatch(
      /MOVED GitHub 12.3.0 \(recorded 12.2.0\)/,
    )
  })

  it('fails loudly when the literal is gone or HTTP fails', async () => {
    expect((await run(fake(null, '12.3.0'), rec, 'x')).code).toBe(1)
    expect((await run(fake('12.2.0', null), rec, 'x')).code).toBe(1)
    expect(
      (await run(fake('12.2.0', '12.3.0', 503), rec, 'x')).lines[0],
    ).toMatch(/HTTP 503/)
  })

  it('is silent-ok offline', async () => {
    const off = async () => {
      throw new TypeError('fetch failed')
    }
    const r = await run(off, rec, 'x')
    expect(r.code).toBe(0)
    expect(r.lines[0]).toMatch(/offline/)
  })

  it('defaults compare against the recorded table', async () => {
    const r = await run(fake('12.2.0', '12.3.0'))
    expect(r.code).toBe(0)
  })
})
