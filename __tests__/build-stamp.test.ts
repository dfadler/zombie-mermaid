import { describe, expect, it } from 'vitest'
import {
  buildStamp,
  resolveBuildStamp,
  stampHtml,
} from '../scripts/build-stamp.ts'

const SHA = 'a'.repeat(40)
const noGit = () => {
  throw new Error('no git')
}

describe('build stamp (#1613)', () => {
  it('prefers GITHUB_SHA, then git, then unknown', () => {
    expect(resolveBuildStamp({ GITHUB_SHA: SHA }, noGit, '1.2.3')).toEqual({
      sha: SHA,
      version: '1.2.3',
    })
    expect(
      resolveBuildStamp({}, () => `${'b'.repeat(40)}\n`, '1.2.3').sha,
    ).toBe('b'.repeat(40))
    expect(resolveBuildStamp({}, noGit, '1.2.3').sha).toBe('unknown')
    expect(resolveBuildStamp({}, () => 'fatal: not a repo', '1').sha).toBe(
      'unknown',
    )
    expect(resolveBuildStamp({ GITHUB_SHA: 'junk' }, noGit, '1').sha).toBe(
      'unknown',
    )
  })

  it('buildStamp reads the real package version and caches', () => {
    const s = buildStamp()
    expect(s.version).toMatch(/^\d+\.\d+\.\d+/)
    expect(s.sha).toMatch(/^([0-9a-f]{40}|unknown)$/)
    expect(buildStamp()).toBe(s)
    // Default git lookup: a real sha in a checkout, `unknown` otherwise
    expect(resolveBuildStamp({}).sha).toMatch(/^([0-9a-f]{40}|unknown)$/)
  })

  it('inserts both meta tags right after <head>', () => {
    const out = stampHtml('<html><head><title>x</title></head></html>', {
      sha: SHA,
      version: '1.2.3',
    })
    expect(out).toContain(
      `<head><meta name="build-sha" content="${SHA}"/><meta name="build-version" content="1.2.3"/><title>`,
    )
    expect(stampHtml('<p>no head</p>', { sha: SHA, version: '1' })).toBe(
      '<p>no head</p>',
    )
  })
})
