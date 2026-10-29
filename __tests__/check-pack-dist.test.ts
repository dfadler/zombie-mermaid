import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs script without types
import {
  cliChunkProblems,
  mapProblems,
  missingEntries,
} from '../scripts/check-pack-dist.mjs'

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

describe('check-pack-dist source maps (#2195)', () => {
  const withMap = (files: string[], js: string) => {
    const d = pkgDir(true)
    const pkg = JSON.parse(readFileSync(join(d, 'package.json'), 'utf8'))
    writeFileSync(join(d, 'package.json'), JSON.stringify({ ...pkg, files }))
    writeFileSync(join(d, 'dist/index.js'), js)
    writeFileSync(join(d, 'dist/index.js.map'), '{}')
    return d
  }
  const ref = '//# sourceMappingURL=index.js.map\n'
  it('flags a shipped .map', () => {
    expect(mapProblems(withMap(['dist/'], ref))).toEqual([
      'ships dist/index.js.map',
    ])
  })
  it('flags a sourceMappingURL whose map is excluded from the tarball', () => {
    expect(mapProblems(withMap(['dist/', '!dist/**/*.map'], ref))).toEqual([
      'dist/index.js -> missing index.js.map',
    ])
  })
  it('passes when maps are excluded and not referenced', () => {
    expect(mapProblems(withMap(['dist/', '!dist/**/*.map'], 'x\n'))).toEqual([])
  })
})

describe('check-pack-dist cli chunks (#2272)', () => {
  const withCli = (js: string) => {
    const d = pkgDir(true)
    writeFileSync(join(d, 'dist/cli.js'), js)
    return d
  }
  it('flags a cli that bundles its own src-* chunk', () => {
    expect(
      cliChunkProblems(withCli('await import("./src-AbC123.js");')),
    ).toEqual(['dist/cli.js loads its own chunk ./src-AbC123.js'])
  })
  it('passes when the cli imports the shared ascii-layout entry', () => {
    expect(
      cliChunkProblems(withCli('import{a}from"./ascii-layout.js";')),
    ).toEqual([])
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
