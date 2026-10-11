import { describe, expect, it, vi } from 'vitest'
// @ts-expect-error plain .mjs script without types
import {
  driftError,
  main,
  run,
  siteVersion,
} from '../scripts/check-site-drift.mjs'

const html = (v: string) =>
  `<script type="application/ld+json">{"softwareVersion":"${v}"}</script>`
const now = Date.parse('2026-10-10T12:00:00Z')

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
})
