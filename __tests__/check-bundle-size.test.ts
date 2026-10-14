import { afterEach, describe, expect, it, vi } from 'vitest'

// Runs scripts/check-bundle-size.ts in-process against a fake dist/ so the
// unpacked-size gate (#1569) is tested without a build. The script is all
// top-level code, so each case re-imports it with fresh mocks.

type Files = Record<string, number | null> // path under dist/ -> size; null = not a file

async function run(
  unpackedBudgets: Record<string, number>,
  dirs: Record<string, Files | 'missing'>,
  gzip: {
    budgets?: Record<string, number>
    consumerBundles?: Record<string, number>
  } = {},
) {
  vi.resetModules()
  const exit = vi
    .spyOn(process, 'exit')
    .mockImplementation((() => undefined) as never)
  const out: string[] = []
  vi.spyOn(console, 'log').mockImplementation((m) => void out.push(String(m)))
  vi.spyOn(console, 'error').mockImplementation((m) => void out.push(String(m)))

  vi.doMock('esbuild', () => ({
    build: async () => ({ outputFiles: [{ contents: new Uint8Array(10) }] }),
  }))
  vi.doMock('node:fs/promises', () => {
    const dirOf = (p: string) =>
      Object.keys(dirs).find((d) => p.includes(`/${d}`))
    return {
      readFile: async (u: URL) => {
        if (String(u).endsWith('bundle-size-budget.json'))
          return JSON.stringify({
            unit: 'gzip-bytes',
            budgets: gzip.budgets ?? {},
            consumerBundles: gzip.consumerBundles ?? {},
            unpackedBudgets,
          })
        if (String(u).endsWith('/dist/f.js')) return Buffer.from('x'.repeat(50))
        throw new Error('ENOENT')
      },
      readdir: async (d: string) => {
        const files = dirs[dirOf(d)!]
        if (files === 'missing' || !files) throw new Error('ENOENT')
        return Object.keys(files)
      },
      stat: async (p: string) => {
        const files = dirs[dirOf(p)!] as Files
        const size = files[p.slice(p.indexOf('/dist/') + 6)]
        return { isFile: () => size !== null, size: size ?? 0 }
      },
    }
  })
  await import('../scripts/check-bundle-size.ts')
  return { code: exit.mock.calls[0]?.[0], text: out.join('\n') }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.doUnmock('node:fs/promises')
  vi.doUnmock('esbuild')
})

describe('scripts/check-bundle-size.ts unpacked budgets', () => {
  it('sums every file except .map and non-files, and passes under budget', async () => {
    const r = await run(
      { 'pkg/dist': 1000 },
      {
        'pkg/dist': {
          'a.js': 400,
          'a.js.map': 9999,
          'sub/b.d.ts': 600,
          sub: null,
        },
      },
    )
    expect(r.code).toBe(0)
    expect(r.text).toMatch(
      /pkg\/dist\s+1000 B \/\s+1000 B\s+headroom\s+0\.0%\s+ok/,
    )
  })

  it('fails with exit 1 when the unpacked size exceeds the budget', async () => {
    const r = await run({ 'pkg/dist': 1000 }, { 'pkg/dist': { 'a.js': 1001 } })
    expect(r.code).toBe(1)
    expect(r.text).toMatch(/OVER/)
    expect(r.text).toMatch(/FAIL/)
  })

  it('reports a missing dist/ as a build-first failure', async () => {
    const r = await run({ 'pkg/dist': 1000 }, { 'pkg/dist': 'missing' })
    expect(r.code).toBe(1)
    expect(r.text).toMatch(/MISSING/)
  })

  it('prints bytes, budget and headroom for gzip and consumer entries', async () => {
    const r = await run(
      {},
      {},
      { budgets: { 'dist/f.js': 100 }, consumerBundles: { 'pkg/c.js': 5 } },
    )
    expect(r.text).toMatch(
      /dist\/f\.js\s+\d+ B \/\s+100 B\s+headroom\s+[\d.]+%\s+ok/,
    )
    expect(r.text).toMatch(
      /pkg\/c\.js\s+\d+ B \/\s+5 B\s+headroom\s+-[\d.]+%\s+OVER/,
    )
    expect(r.code).toBe(1)
  })

  it('flags an over-budget gzip file and passes an in-budget consumer bundle', async () => {
    const r = await run(
      {},
      {},
      { budgets: { 'dist/f.js': 1 }, consumerBundles: { 'pkg/c.js': 100 } },
    )
    expect(r.text).toMatch(
      /dist\/f\.js\s+\d+ B \/\s+1 B\s+headroom\s+-[\d.]+%\s+OVER/,
    )
    expect(r.text).toMatch(
      /pkg\/c\.js\s+\d+ B \/\s+100 B\s+headroom\s+[\d.]+%\s+ok/,
    )
    expect(r.code).toBe(1)
  })
})
