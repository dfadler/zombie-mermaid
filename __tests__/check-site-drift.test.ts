import { describe, expect, it, vi } from 'vitest'
// @ts-expect-error plain .mjs script without types
import {
  driftError,
  main,
  run,
  shaError,
  siteStamp,
  siteVersion,
  stuckRuns,
} from '../scripts/check-site-drift.mjs'

const html = (v: string) =>
  `<script type="application/ld+json">{"softwareVersion":"${v}"}</script>`
const now = Date.parse('2026-10-10T12:00:00Z')

describe('stuckRuns', () => {
  const runs = [
    { databaseId: 1, status: 'waiting', createdAt: '2026-10-10T11:00:00Z' },
    { databaseId: 2, status: 'in_progress', createdAt: '2026-10-10T11:50:00Z' },
    { databaseId: 3, status: 'completed', createdAt: '2026-10-01T00:00:00Z' },
    { databaseId: 4, status: 'pending', createdAt: '2026-10-10T11:20:00Z' },
  ]
  it('selects unfinished runs older than the threshold', () => {
    expect(stuckRuns(runs, now)).toEqual([1, 4])
    expect(stuckRuns(runs, now, 5)).toEqual([1, 2, 4])
    expect(stuckRuns([], now)).toEqual([])
  })
})

describe('check-site-drift', () => {
  it('parses softwareVersion from JSON-LD', () => {
    expect(siteVersion(html('4.2.0'))).toBe('4.2.0')
    expect(siteVersion('<p>none</p>')).toBeNull()
  })
  it('flags a stale site only after the grace period', () => {
    const base = { site: '4.2.0', latest: '5.0.0', now }
    expect(
      driftError({ ...base, publishedAt: '2026-10-10T00:00:00Z' }),
    ).toBeNull()
    expect(
      driftError({ ...base, publishedAt: '2026-10-08T00:00:00Z' }),
    ).toMatch(/4\.2\.0/)
    expect(
      driftError({
        ...base,
        site: '5.0.0',
        publishedAt: '2026-10-01T00:00:00Z',
      }),
    ).toBeNull()
    expect(
      driftError({ ...base, site: null, publishedAt: '2026-10-10T00:00:00Z' }),
    ).toMatch(/no softwareVersion/)
  })

  describe('run', () => {
    const reg = (publishedAt: string) => ({
      'dist-tags': { latest: '5.0.0' },
      time: { '5.0.0': publishedAt },
    })
    const mkFetch = (registry: unknown, page: string, status = 200) =>
      vi.fn(async (u: string) =>
        u.startsWith('https://registry.npmjs.org/')
          ? { ok: true, json: async () => registry }
          : { ok: status === 200, status, text: async () => page },
      )
    const env = { SITE_URL: 'https://site.test/', PACKAGE: 'pkg' }

    it('reports fresh when versions match and logs the pages.yml time', async () => {
      const f = mkFetch(reg('2026-10-01T00:00:00Z'), html('5.0.0'))
      const r = await run({ ...env, LAST_PAGES_SUCCESS: 'T1' }, f, now)
      expect(r).toEqual({
        line: 'site=5.0.0 npm=5.0.0 last pages.yml success=T1',
        err: null,
      })
      expect(f).toHaveBeenCalledWith('https://registry.npmjs.org/pkg')
      expect(f).toHaveBeenCalledWith('https://site.test/')
    })
    it('returns an error when stale past GRACE_HOURS only', async () => {
      const f = mkFetch(reg('2026-10-10T00:00:00Z'), html('4.2.0'))
      expect((await run(env, f, now)).err).toBeNull()
      const r = await run({ ...env, GRACE_HOURS: '6' }, f, now)
      expect(r.err).toMatch(/4\.2\.0.*5\.0\.0/)
      expect(r.line).toContain('last pages.yml success=unknown')
    })
    it('throws on a non-OK HTTP response', async () => {
      const f = mkFetch(reg('2026-10-01T00:00:00Z'), '', 503)
      await expect(run(env, f, now)).rejects.toThrow(
        'https://site.test/: HTTP 503',
      )
    })
    it('main prints the status line and exits 0 when fresh', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const f = mkFetch(reg('2026-10-01T00:00:00Z'), html('5.0.0'))
      expect(await main(env, f)).toBe(0)
      expect(log).toHaveBeenCalledWith(expect.stringContaining('site=5.0.0'))
      expect(errSpy).not.toHaveBeenCalled()
      log.mockRestore()
      errSpy.mockRestore()
    })
    it('main emits a ::error:: annotation and exits 1 when stale', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      // registry time far in the past vs real Date.now()
      const f = mkFetch(reg('2020-01-01T00:00:00Z'), html('4.2.0'))
      expect(await main(env, f)).toBe(1)
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^::error::site serves 4\.2\.0/),
      )
      log.mockRestore()
      errSpy.mockRestore()
    })
  })

  describe('build-sha stamp (#1613)', () => {
    const LIVE = 'a'.repeat(40)
    const stamped = `<meta name="build-sha" content="${LIVE}"/><meta name="build-version" content="5.0.0"/>${html('5.0.0')}`
    const mainDate = '2026-10-10T10:00:00Z' // 2h before `now`
    const behind = (filename: string) => ({
      status: 'ahead',
      commits: [{ sha: 'b'.repeat(40) }],
      files: [{ filename }],
    })
    const base = { liveSha: LIVE, mainDate, now }

    it('parses the stamp', () => {
      expect(siteStamp(stamped)).toEqual({ sha: LIVE, version: '5.0.0' })
      expect(siteStamp('<p/>')).toEqual({ sha: null, version: null })
    })
    it('is fresh when identical, or behind only on non-deploying paths', () => {
      expect(shaError({ ...base, compare: { status: 'identical' } })).toBeNull()
      expect(
        shaError({
          ...base,
          mainDate: '2026-10-01T00:00:00Z',
          compare: behind('__tests__/x.test.ts'),
        }),
      ).toBeNull()
    })
    it('flags behind main only after the grace period', () => {
      const compare = behind('packages/core/src/a.ts')
      expect(
        shaError({ ...base, mainDate: '2026-10-10T11:30:00Z', compare }),
      ).toBeNull()
      expect(shaError({ ...base, graceHours: 1, compare })).toMatch(
        /not deployed/,
      )
      expect(
        shaError({
          ...base,
          compare: behind('.github/workflows/pages.yml'),
          graceHours: 1,
        }),
      ).toMatch(/not deployed/)
      expect(
        shaError({
          ...base,
          compare: behind('.github/workflows/ci.yml'),
          graceHours: 1,
        }),
      ).toBeNull()
    })
    it('flags missing, unknown, foreign and ahead-of-main stamps', () => {
      expect(shaError({ ...base, liveSha: null, compare: null })).toMatch(
        /no usable/,
      )
      expect(shaError({ ...base, liveSha: 'unknown', compare: null })).toMatch(
        /no usable/,
      )
      expect(shaError({ ...base, compare: null })).toMatch(/not a commit/)
      expect(shaError({ ...base, compare: { status: 'behind' } })).toMatch(
        /ahead of main/,
      )
    })

    const gh = (compare: unknown, page = stamped, cStatus = 200) =>
      vi.fn(async (u: string) => {
        if (u.startsWith('https://registry.npmjs.org/'))
          return { ok: true, json: async () => reg5 }
        if (u.endsWith('/commits/main'))
          return {
            ok: true,
            json: async () => ({ commit: { committer: { date: mainDate } } }),
          }
        if (u.includes('/compare/'))
          return {
            ok: cStatus === 200,
            status: cStatus,
            json: async () => compare,
          }
        return { ok: true, text: async () => page }
      })
    const reg5 = {
      'dist-tags': { latest: '5.0.0' },
      time: { '5.0.0': '2026-10-01T00:00:00Z' },
    }
    const env = { SITE_URL: 'https://site.test/', PACKAGE: 'pkg', REPO: 'o/r' }

    it('run adds stamp info and passes when identical', async () => {
      const r = await run(env, gh({ status: 'identical' }), now)
      expect(r.err).toBeNull()
      expect(r.line).toContain(`build-sha=${LIVE} build-version=5.0.0`)
    })
    it('run errors when the live sha is behind main past grace', async () => {
      const r = await run(
        { ...env, SHA_GRACE_HOURS: '1' },
        gh(behind('demo/a.tsx')),
        now,
      )
      expect(r.err).toMatch(/not deployed/)
    })
    it('run errors on an unstamped site and on an unknown sha (404)', async () => {
      expect((await run(env, gh(null, html('5.0.0')), now)).err).toMatch(
        /no usable/,
      )
      expect((await run(env, gh(null, stamped, 404), now)).err).toMatch(
        /not a commit/,
      )
    })
  })
})
