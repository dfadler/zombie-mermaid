import { describe, expect, it, vi } from 'vitest'
import {
  anchors,
  checkAll,
  checkDoc,
  engineMatches,
  main,
} from '../scripts/check-docs.ts'

const has = (set: string[]) => (p: string) => set.some((s) => p.endsWith(s))
const run = (md: string, existing: string[] = []) =>
  checkDoc('docs/a.md', md, '24', has(existing), () => '# Real heading\n')

describe('check-docs', () => {
  it('flags broken links, missing anchors, stale paths, counts, node', () => {
    const errs = run(
      '[x](./gone.md) [y](./b.md#nope) `src/old.ts` 3 diagram types Node.js 22',
      ['b.md'],
    )
    expect(errs).toHaveLength(5)
  })
  it('accepts good input and ignores code fences', () => {
    expect(
      run(
        '[y](./b.md#real-heading) `src/ok.ts` 8 diagram types Node 24\n```\n`src/x.ts`\n```',
        ['b.md', 'src/ok.ts'],
      ),
    ).toEqual([])
  })
})

describe('check-docs review fixes', () => {
  it('ignores tilde fences and honors closing-fence length', () => {
    expect(run('~~~\n[x](./gone.md)\n~~~')).toEqual([])
    expect(run('````\n```\n[x](./gone.md)\n```\n````')).toEqual([])
    expect(run('~~~\n```\n[x](./gone.md)\n')).toEqual([])
    expect(run('```\n[x](./gone.md)\n~~~\n[y](./gone.md)')).toEqual([])
    expect(run('```\ncode\n```\n[x](./gone.md)')).toHaveLength(1)
  })
  it('hides headings inside tilde fences from anchors', () => {
    expect(anchors('~~~\n# Hidden\n~~~\n# Shown')).toEqual(new Set(['shown']))
  })
  it('checks reference-style link definitions', () => {
    expect(run('[g]: ./gone.md "t"')).toHaveLength(1)
    expect(run('[g]: <./gone.md>')).toHaveLength(1)
    expect(run('[g]: ./b.md', ['b.md'])).toEqual([])
    expect(run('[g]: https://x.dev')).toEqual([])
  })
  it('requires engines.node to admit only the .nvmrc major or newer', () => {
    expect(engineMatches('>=24', '24')).toBe(true)
    expect(engineMatches('^24.1.0', '24')).toBe(true)
    expect(engineMatches('>=20 || >=24', '24')).toBe(false)
    expect(engineMatches('>=24 || >=20', '24')).toBe(false)
    expect(engineMatches('>=20', '24')).toBe(false)
    expect(engineMatches('>=240', '24')).toBe(false)
  })
})

describe('check-docs orchestration', () => {
  const fakeFs = (files: Record<string, string>) => ({
    read: (p: string) => files[p] ?? '',
    ls: (g: string) =>
      Object.keys(files).filter((f) =>
        g === '*.md' ? f.endsWith('.md') : f.startsWith(g),
      ),
  })
  const base = {
    '.nvmrc': 'v24.1.0\n',
    'package.json': '{"engines":{"node":">=24"}}',
  }
  it('passes a consistent tree', () => {
    const r = checkAll(
      fakeFs({
        ...base,
        '.github/workflows/ci.yml': "node-version: '24'",
        'README.md': 'ok',
      }),
    )
    expect(r).toEqual({ files: 1, errs: [] })
  })
  it('reports engines and workflow node drift, skips frozen/stale docs', () => {
    const r = checkAll(
      fakeFs({
        '.nvmrc': '24',
        'package.json': '{"engines":{"node":">=20 || >=24"}}',
        '.github/workflows/ci.yml': 'node-version: 22',
        'CHANGELOG.md': '[x](./gone.md)',
        'docs/research/a.md': '[x](./gone.md)',
        'CLAUDE.md': '`demo/client.ts`',
      }),
    )
    expect(r.files).toBe(0)
    expect(r.errs).toEqual([
      'package.json engines.node ">=20 || >=24" vs .nvmrc 24',
      '.github/workflows/ci.yml: node-version 22 vs .nvmrc 24',
    ])
  })
  it('default fs reads the real repo, which has no drift', () => {
    expect(checkAll().errs).toEqual([])
    expect(checkDoc('README.md', '[x](./LICENSE)', '24')).toEqual([])
  })
})

describe('check-docs main', () => {
  it('returns 0 and reports ok on a clean tree', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    expect(main({ read: () => '{}', ls: () => [] })).toBe(0)
    expect(log).toHaveBeenCalledWith('docs drift: 0 files ok')
    log.mockRestore()
  })
  it('returns 1 and prints the problems on drift', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fs = {
      read: (p: string) =>
        p === '.nvmrc' ? '24' : p === 'package.json' ? '{}' : '[x](./gone.md)',
      ls: (g: string) => (g === '*.md' ? ['docs/a.md'] : []),
    }
    expect(main(fs)).toBe(1)
    expect(err.mock.calls[0]![0]).toContain('broken link ./gone.md')
    expect(err.mock.calls[0]![0]).toContain('1 docs drift problem(s)')
    err.mockRestore()
  })
})
