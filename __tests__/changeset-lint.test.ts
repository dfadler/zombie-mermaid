import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lintChangeset, lintChangesetDir } from '../scripts/lib/changeset-lint'

const cs = (bump: string, summary: string) =>
  `---\n'zombie-mermaid': ${bump}\n---\n\n${summary}\n`
const GUIDE = '[guide](docs/guides/upgrading-2x-to-5x.md#x)'

describe('lintChangeset', () => {
  it('ignores empty changesets', () => {
    expect(lintChangeset('a.md', '---\n---\n')).toEqual({
      file: 'a.md',
      errors: [],
      warnings: [],
    })
  })
  it('ignores text without frontmatter', () => {
    expect(lintChangeset('a.md', 'hello').errors).toEqual([])
  })
  it('errors on a major without **BREAKING:**', () => {
    expect(
      lintChangeset('a.md', cs('major', `Dropped x. ${GUIDE}`)).errors,
    ).toHaveLength(1)
  })
  it('accepts a major with **BREAKING:** and a guide link', () => {
    const r = lintChangeset(
      'a.md',
      cs('major', `**BREAKING:** dropped x. ${GUIDE}`),
    )
    expect(r.errors).toEqual([])
    expect(r.warnings).toEqual([])
  })
  it('warns on a major without a guide link', () => {
    const r = lintChangeset('a.md', cs('major', '**BREAKING:** dropped x.'))
    expect(r.errors).toEqual([])
    expect(r.warnings).toHaveLength(1)
  })
  it('warns when a major says Output change', () => {
    const r = lintChangeset(
      'a.md',
      cs('major', `**BREAKING:** Output change: y. ${GUIDE}`),
    )
    expect(r.warnings).toHaveLength(1)
  })
  it('warns on a minor that mentions engines or peerDependencies without BREAKING', () => {
    expect(
      lintChangeset('a.md', cs('minor', 'Raised engines.node to 24.')).warnings,
    ).toHaveLength(1)
    expect(
      lintChangeset('a.md', cs('minor', 'New optional peerDependencies entry.'))
        .warnings,
    ).toHaveLength(1)
  })
  it('does not warn on a plain minor or patch', () => {
    expect(
      lintChangeset('a.md', cs('minor', 'Output change: x.')),
    ).toMatchObject({ errors: [], warnings: [] })
    expect(lintChangeset('a.md', cs('patch', 'engines mention'))).toMatchObject(
      { warnings: [] },
    )
  })
  it('errors on a **BREAKING:** summary without a major bump', () => {
    expect(
      lintChangeset('a.md', cs('minor', '**BREAKING:** Raised engines.node.'))
        .errors,
    ).toHaveLength(1)
  })
  it('reads quoted bump values', () => {
    expect(
      lintChangeset('a.md', `---\n"a": "major"\n---\n\nx\n`).errors,
    ).toHaveLength(1)
  })
  it('warns when the guide mention has no section anchor', () => {
    const r = lintChangeset(
      'a.md',
      cs('major', '**BREAKING:** x. See docs/guides/upgrading later'),
    )
    expect(r.warnings).toHaveLength(1)
  })
  it('reads double-quoted and mixed bump lists', () => {
    const t = `---\n"a": patch\n'b': major\n---\n\nx\n`
    expect(lintChangeset('a.md', t).errors).toHaveLength(1)
  })
})

describe('lintChangesetDir', () => {
  it('returns only files with findings and skips README.md', () => {
    const d = mkdtempSync(join(tmpdir(), 'cs-'))
    writeFileSync(join(d, 'README.md'), "---\n'x': major\n---\nnope")
    writeFileSync(join(d, 'ok.md'), cs('patch', 'fine'))
    writeFileSync(join(d, 'bad.md'), cs('major', 'no marker'))
    writeFileSync(join(d, 'notes.txt'), 'ignored')
    expect(lintChangesetDir(d).map((r) => r.file)).toEqual(['bad.md'])
  })
})
