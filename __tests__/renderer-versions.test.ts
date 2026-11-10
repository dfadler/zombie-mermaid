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
