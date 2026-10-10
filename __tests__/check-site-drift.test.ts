import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs script without types
import { driftError, siteVersion } from '../scripts/check-site-drift.mjs'

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
})
