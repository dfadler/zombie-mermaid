import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs script without types
import { missingEntries } from '../scripts/check-pack-dist.mjs'

const pkgDir = (withDist: boolean) => {
  const d = mkdtempSync(join(tmpdir(), 'zm-pack-'))
  writeFileSync(
    join(d, 'package.json'),
    JSON.stringify({
      name: 'x',
      version: '1.0.0',
      main: 'dist/index.cjs',
      exports: { '.': { import: './dist/index.js' } },
      files: ['dist/'],
    }),
  )
  if (withDist) {
    mkdirSync(join(d, 'dist'))
    writeFileSync(join(d, 'dist/index.cjs'), '')
    writeFileSync(join(d, 'dist/index.js'), '')
  }
  return d
}

describe('check-pack-dist (#1991)', () => {
  it('flags a package packed without dist/', () => {
    expect(missingEntries(pkgDir(false)).sort()).toEqual([
      'dist/index.cjs',
      'dist/index.js',
    ])
  })
  it('passes when dist/ exists', () => {
    expect(missingEntries(pkgDir(true))).toEqual([])
  })
})

describe('publish.yml release job', () => {
  it('builds and runs the pack guard before changesets/action', () => {
    const y = readFileSync('.github/workflows/publish.yml', 'utf8')
    const release = y.slice(
      y.indexOf('\n  release:'),
      y.indexOf('\n  commit-badge-data:'),
    )
    const at = (s: string) => release.indexOf(s)
    expect(at('run: pnpm run build\n')).toBeGreaterThan(-1)
    expect(at('check:pack-dist')).toBeGreaterThan(at('run: pnpm run build\n'))
    expect(at('uses: changesets/action')).toBeGreaterThan(at('check:pack-dist'))
  })
})
