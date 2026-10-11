/**
 * Guards `demo/diagram-pages-data.ts`'s `sampleSlug`/`allExamplesFor`
 * (zombie-mermaid#989) — specifically that no two real samples of the same
 * diagram type collide on the same URL slug, which would silently
 * overwrite one specific-diagram detail page with another at build time.
 *
 * Lives here rather than under src/__tests__ because it imports from
 * demo/, which sits outside tsconfig's `rootDir: "src"` — same reasoning
 * as `demo-diagram-orientation.test.ts`.
 */
import { describe, it, expect } from 'vitest'
import {
  DIAGRAM_TYPE_PROFILES,
  allExamplesFor,
  sampleSlug,
} from '../demo/diagram-pages-data.ts'

describe('sampleSlug', () => {
  it('lowercases, hyphenates non-alphanumeric runs, and trims edges', () => {
    expect(sampleSlug('CI/CD Pipeline')).toBe('ci-cd-pipeline')
    expect(sampleSlug('linkStyle: Color-Coded Edges')).toBe(
      'linkstyle-color-coded-edges',
    )
    expect(sampleSlug('::: Class Shorthand')).toBe('class-shorthand')
    expect(sampleSlug('Direction: Left-Right (LR)')).toBe(
      'direction-left-right-lr',
    )
  })
})

describe('allExamplesFor', () => {
  it('returns every real sample for a known type, none for an unknown slug', () => {
    expect(allExamplesFor('flowchart').length).toBeGreaterThan(0)
    expect(allExamplesFor('not-a-real-type')).toEqual([])
  })

  it('produces a unique url slug per sample within every diagram type', () => {
    for (const profile of DIAGRAM_TYPE_PROFILES) {
      const samples = allExamplesFor(profile.slug)
      const slugs = samples.map((s) => sampleSlug(s.title))
      const unique = new Set(slugs)
      expect(
        unique.size,
        `${profile.slug}: expected ${slugs.length} unique slugs, got ${unique.size} (${JSON.stringify(slugs)})`,
      ).toBe(slugs.length)
    }
  })
})
