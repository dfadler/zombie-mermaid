import { afterEach, describe, it, expect, vi } from 'vitest'
import { fileURLToPath } from 'node:url'
import {
  isBehind,
  pinFreshness,
} from '../../scripts/lib/mermaid-pin-freshness.ts'

describe('mermaid pin freshness', () => {
  it.each([
    ['11.17.2', '12.1.0', true],
    ['12.1.0', '12.2.0', true],
    ['12.1.0', '12.1.5', false],
    ['12.1.0', '12.1.0', false],
    ['12.1.0', '11.17.2', false],
  ])('isBehind(%s, %s) is %s', (pinned, latest, expected) => {
    expect(isBehind(pinned, latest)).toBe(expected)
  })

  it('warns, naming both versions, when the pin is behind', () => {
    const r = pinFreshness('12.1.0', '11.17.2')
    expect(r.stale).toBe(true)
    expect(r.message).toContain('11.17.2')
    expect(r.message).toContain('12.1.0')
  })

  it('is quiet when the pin is current', () => {
    expect(pinFreshness('12.1.0', '12.1.0').stale).toBe(false)
  })
})

// The npm lookup is the module's only I/O boundary: stub execFileSync so no
// test touches the network.
describe('mermaid pin freshness: npm lookup', () => {
  afterEach(() => {
    vi.doUnmock('node:child_process')
    vi.resetModules()
    vi.restoreAllMocks()
  })

  async function load(exec: () => string) {
    vi.resetModules()
    vi.doMock('node:child_process', () => ({ execFileSync: exec }))
    return import('../../scripts/lib/mermaid-pin-freshness.ts')
  }

  it('asks npm for the latest version and trims it', async () => {
    const exec = vi.fn(() => '13.0.0\n')
    const { pinFreshness: pf } = await load(exec)
    const r = pf(undefined, '12.1.0')
    expect(exec).toHaveBeenCalledWith(
      'npm',
      ['view', 'mermaid', 'version'],
      expect.objectContaining({ timeout: 15_000 }),
    )
    expect(r).toMatchObject({ latest: '13.0.0', stale: true })
  })

  it('reports unknown, not stale, when npm fails (offline)', async () => {
    const { pinFreshness: pf } = await load(() => {
      throw new Error('ENOTFOUND')
    })
    const r = pf(undefined, '12.1.0')
    expect(r.latest).toBeUndefined()
    expect(r.stale).toBe(false)
    expect(r.message).toContain('latest unknown')
  })

  it('reports unknown when npm prints nothing', async () => {
    const { pinFreshness: pf } = await load(() => '\n')
    expect(pf(undefined, '12.1.0').stale).toBe(false)
  })

  it.each(['^12.1.0', '~12.1.0', '12.1.0'])(
    'strips a range prefix from the package.json pin (%s)',
    async (range) => {
      vi.resetModules()
      vi.doMock('node:fs', async (orig) => ({
        ...(await orig<typeof import('node:fs')>()),
        readFileSync: () =>
          JSON.stringify({ devDependencies: { mermaid: range } }),
      }))
      const { pinFreshness: pf } =
        await import('../../scripts/lib/mermaid-pin-freshness.ts')
      expect(pf('12.1.0').pinned).toBe('12.1.0')
      vi.doUnmock('node:fs')
    },
  )

  it.each([
    ['99.0.0', /^STALE\s+mermaid pin .* 99\.0\.0/],
    ['0.0.1', /^ok\s+mermaid pinned at /],
  ])(
    'prints a one-line result when run as a script (npm latest %s)',
    async (latest, pattern) => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})
      const argv1 = process.argv[1]
      process.argv[1] = fileURLToPath(
        new URL('../../scripts/lib/mermaid-pin-freshness.ts', import.meta.url),
      )
      try {
        await load(() => `${latest}\n`)
      } finally {
        process.argv[1] = argv1!
      }
      expect(log).toHaveBeenCalledTimes(1)
      expect(String(log.mock.calls[0]![0])).toMatch(pattern)
    },
  )
})
