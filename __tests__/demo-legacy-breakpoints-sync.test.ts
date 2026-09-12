/**
 * Guards the #1030 breakpoint consolidation: demo/styles.css,
 * demo/dashboard.css, demo/diagram-page.css, demo/fork-fixes.css, and
 * demo/blog.css can't `import` demo/components/tokens.tsx's
 * `LEGACY_BREAKPOINTS` — CSS custom properties don't resolve inside an
 * `@media` condition — so each rule instead keeps a literal pixel value
 * tagged with a trailing comment naming the shared constant it must match
 * (e.g. `@media (max-width: 900px) /* LEGACY_BREAKPOINTS.tablet *\/`).
 *
 * That comment is documentation, not enforcement, on its own — nothing stops
 * a future edit from changing the number while leaving the tag (or vice
 * versa) and drifting silently, exactly the failure mode #1030 was filed to
 * close off. This test parses every tagged rule back out of each file and
 * fails if a tagged number and `LEGACY_BREAKPOINTS[key]` ever disagree, or if
 * a `min-width`/`max-width` media feature appears without a tag at all
 * (a new breakpoint introduced without joining the shared registry).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LEGACY_BREAKPOINTS } from '../demo/components/tokens.tsx'

const CSS_FILES = [
  '../demo/styles.css',
  '../demo/dashboard.css',
  '../demo/diagram-page.css',
  '../demo/fork-fixes.css',
  '../demo/blog.css',
]

/** Matches `@media (max-width: 900px) /* LEGACY_BREAKPOINTS.tablet *\/` (or min-width). */
const TAGGED_MEDIA_RE =
  /@media \((min-width|max-width): (\d+)px\) \/\* LEGACY_BREAKPOINTS\.(\w+) \*\//g

/** Matches any width-based @media feature, tagged or not. */
const ANY_WIDTH_MEDIA_RE = /@media \((?:min-width|max-width): \d+px\)/g

describe.each(CSS_FILES)('%s', (relativePath) => {
  const css = readFileSync(new URL(relativePath, import.meta.url), 'utf8')

  it('tags every width-based @media rule with a LEGACY_BREAKPOINTS key', () => {
    const tagged = css.match(TAGGED_MEDIA_RE) ?? []
    const all = css.match(ANY_WIDTH_MEDIA_RE) ?? []
    expect(tagged).toHaveLength(all.length)
  })

  it('matches LEGACY_BREAKPOINTS for every tagged rule', () => {
    const matches = [...css.matchAll(TAGGED_MEDIA_RE)]
    expect(matches.length).toBeGreaterThan(0)
    for (const [, , px, key] of matches) {
      expect(key).not.toBeUndefined()
      const expected =
        LEGACY_BREAKPOINTS[key as keyof typeof LEGACY_BREAKPOINTS]
      expect(
        expected,
        `${relativePath}: LEGACY_BREAKPOINTS has no key "${key}"`,
      ).not.toBeUndefined()
      expect(
        Number(px),
        `${relativePath}: tagged LEGACY_BREAKPOINTS.${key} as ${px}px, but the shared constant is ${expected}px`,
      ).toBe(expected)
    }
  })
})

describe('theme-picker.tsx', () => {
  const source = readFileSync(
    new URL('../demo/components/theme-picker.tsx', import.meta.url),
    'utf8',
  )

  it('references LEGACY_BREAKPOINTS.desktopBelow instead of a literal width', () => {
    expect(source).toContain(
      '@media (max-width: ${LEGACY_BREAKPOINTS.desktopBelow}px)',
    )
    expect(source).not.toMatch(/@media \(max-width: \d+px\)/)
  })
})
