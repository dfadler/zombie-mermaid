import { describe, expect, it } from 'vitest'
import {
  changesetPackages,
  missingPackages,
} from '../scripts/lib/changeset-coverage'

const PKGS = {
  'svg-renderer': '@zombie-mermaid/svg-renderer',
  core: '@zombie-mermaid/core',
}
const cs = (...names: string[]) =>
  `---\n${names.map((n) => `'${n}': patch`).join('\n')}\n---\n\nx\n`

describe('changesetPackages', () => {
  it('lists quoted and bare names', () => {
    expect(
      changesetPackages(`---\n"a": minor\nb: patch\n---\nsummary: x\n`),
    ).toEqual(['a', 'b'])
  })
  it('is empty for an empty changeset and for no frontmatter', () => {
    expect(changesetPackages('---\n---\n')).toEqual([])
    expect(changesetPackages('hello')).toEqual([])
  })
})

describe('missingPackages', () => {
  const src = 'packages/svg-renderer/src/renderer.ts'
  it('flags changed package source with no naming changeset', () => {
    expect(missingPackages([src], [cs('zombie-mermaid')], PKGS)).toEqual([
      '@zombie-mermaid/svg-renderer',
    ])
    expect(missingPackages([src], [], PKGS)).toHaveLength(1)
  })
  it('passes when the package is named', () => {
    expect(
      missingPackages([src], [cs('@zombie-mermaid/svg-renderer')], PKGS),
    ).toEqual([])
  })
  it('allows an empty changeset when no package source changed', () => {
    const files = [
      'docs/a.md',
      'packages/svg-renderer/src/__tests__/a.test.ts',
      'packages/svg-renderer/src/sequence/__tests__/b.snap',
      'packages/unknown/src/x.ts',
      'packages/svg-renderer/package.json',
    ]
    expect(missingPackages(files, ['---\n---\n'], PKGS)).toEqual([])
  })
  it('reports each package once, sorted', () => {
    const files = [src, src, 'packages/core/src/types.ts']
    expect(missingPackages(files, [], PKGS)).toEqual([
      '@zombie-mermaid/core',
      '@zombie-mermaid/svg-renderer',
    ])
  })
})
