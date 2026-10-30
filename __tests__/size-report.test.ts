import { describe, expect, it } from 'vitest'
import {
  UNMAPPED,
  attribute,
  classify,
  findDuplicates,
  measure,
  moduleLabel,
  table,
  tarballByKind,
  topN,
} from '../scripts/lib/size-report.ts'

describe('size-report', () => {
  it('measure: raw, gzip and brotli of a buffer or string', () => {
    const s = measure('a'.repeat(1000))
    expect(s.raw).toBe(1000)
    expect(s.gzip).toBeLessThan(100)
    expect(s.brotli).toBeLessThan(s.gzip)
    expect(measure(Buffer.from('abc')).raw).toBe(3)
  })

  it('attribute: each segment owns text up to the next one', () => {
    // Fields: [col, srcDelta, line, srcCol]. "ICAA" = col 4, next source.
    // Line 2 "EDAA" = col 2, source delta -1 (negative VLQ) back to a.ts.
    const map = { sources: ['a.ts', 'b.ts'], mappings: 'AAAA,ICAA;EDAA' }
    const out = attribute('abcdefghij\nxyz', map)
    expect(out.get('a.ts')).toBe(4 + 2)
    expect(out.get('b.ts')).toBe(7)
    expect(out.get(UNMAPPED)).toBe(2)
  })

  it('attribute: lines without mappings count as unmapped', () => {
    const out = attribute('abc\nde', { sources: ['a.ts'], mappings: 'AAAA' })
    expect(out.get('a.ts')).toBe(4)
    expect(out.get(UNMAPPED)).toBe(3)
  })

  it('attribute: a one-field segment is unmapped', () => {
    const out = attribute('ab', { sources: [], mappings: 'A' })
    expect(out.get(UNMAPPED)).toBe(3)
  })

  it('moduleLabel: repo-relative, collapses node_modules to the package', () => {
    const root = '/r'
    expect(moduleLabel('/r/packages/core/dist', '../src/x.ts', root)).toBe(
      'packages/core/src/x.ts',
    )
    expect(
      moduleLabel(
        '/r/dist',
        '../node_modules/.pnpm/e@1/node_modules/entities/lib/a.js',
        root,
      ),
    ).toBe('node_modules/entities')
    expect(
      moduleLabel('/r/dist', '../node_modules/@scope/pkg/index.js', root),
    ).toBe('node_modules/@scope/pkg')
    expect(moduleLabel('/r/dist', UNMAPPED, root)).toBe(UNMAPPED)
    expect(moduleLabel('/r/dist', './a.ts', '/r/')).toBe('dist/a.ts')
    expect(moduleLabel('/other/dist', './a.ts', '/r')).toBe('/other/dist/a.ts')
  })

  it('topN sorts descending and truncates', () => {
    const rows = [{ bytes: 1 }, { bytes: 9 }, { bytes: 5 }]
    expect(topN(rows, 2)).toEqual([{ bytes: 9 }, { bytes: 5 }])
    expect(rows[0]?.bytes).toBe(1)
  })

  it('findDuplicates: extra weight excludes the largest copy and unmapped', () => {
    const dups = findDuplicates({
      'a.js': new Map([
        ['m.ts', 10],
        ['only-a.ts', 5],
        [UNMAPPED, 99],
      ]),
      'b.js': new Map([
        ['m.ts', 30],
        [UNMAPPED, 99],
      ]),
    })
    expect(dups).toEqual([
      { module: 'm.ts', files: ['a.js', 'b.js'], bytes: 10 },
    ])
  })

  it('classify + tarballByKind bucket every file', () => {
    expect(classify('dist/a.js.map')).toBe('sourcemap')
    expect(classify('dist/a.d.cts')).toBe('dts')
    expect(classify('dist/a.d.ts')).toBe('dts')
    expect(classify('dist/a.cjs')).toBe('cjs')
    expect(classify('dist/a.js')).toBe('esm')
    expect(classify('dist/a.mjs')).toBe('esm')
    expect(classify('package.json')).toBe('manifest')
    expect(classify('README.md')).toBe('docs')
    expect(classify('LICENSE')).toBe('docs')
    expect(classify('x.bin')).toBe('other')
    const t = tarballByKind([
      { path: 'dist/a.js', size: 3 },
      { path: 'dist/a.js.map', size: 4 },
      { path: 'x.bin', size: 1 },
    ])
    expect(t).toMatchObject({ esm: 3, sourcemap: 4, other: 1, cjs: 0 })
  })

  it('table renders a Markdown table', () => {
    expect(table(['a', 'b'], [[1, 'x']])).toBe(
      '| a | b |\n| --- | --- |\n| 1 | x |',
    )
  })
})
