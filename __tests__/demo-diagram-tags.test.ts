/**
 * Guards `demo/diagram-tags.ts`'s TAG_RULES (#991) against real
 * samples-data.ts data: every rule must match at least one real sample
 * (an unmatched rule would silently generate no page, defeating the
 * point of adding it), and the specific cross-category false-positive
 * this taxonomy already caught once — Class's `o--` aggregation marker
 * colliding with ER's `o--` crow's-foot cardinality substring — stays
 * fixed.
 *
 * Lives here rather than under src/__tests__ because it imports from
 * demo/ and the repo-root samples-data.ts, both outside tsconfig's
 * `rootDir: "src"` — same reasoning as `demo-diagram-orientation.test.ts`.
 */
import { describe, it, expect } from 'vitest'
import { samples } from '../samples-data.ts'
import { TAG_RULES } from '../demo/diagram-tags.ts'

describe('TAG_RULES', () => {
  it('has a unique slug and label per rule', () => {
    const slugs = TAG_RULES.map((r) => r.slug)
    const labels = TAG_RULES.map((r) => r.label)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('matches at least one real sample per rule — an unmatched rule would silently generate no page', () => {
    for (const rule of TAG_RULES) {
      const matchCount = samples.filter((s) => rule.test(s)).length
      expect(
        matchCount,
        `${rule.slug} matched zero real samples`,
      ).toBeGreaterThan(0)
    }
  })

  it('does not tag an ER cardinality sample as Class aggregation — the "o--" substring is shared by both notations for unrelated reasons', () => {
    const erAggregationMatches = samples.filter(
      (s) =>
        s.category === 'ER' &&
        TAG_RULES.find((r) => r.slug === 'aggregation-relationship')?.test(s),
    )
    expect(erAggregationMatches).toEqual([])
  })

  it('scopes inheritance/composition/aggregation to Class, and non-identifying-relationship to ER', () => {
    const classOnly = [
      'inheritance-relationship',
      'composition-relationship',
      'aggregation-relationship',
    ]
    for (const slug of classOnly) {
      const rule = TAG_RULES.find((r) => r.slug === slug)
      expect(rule, `missing rule ${slug}`).toBeDefined()
      const matches = samples.filter((s) => rule?.test(s))
      expect(matches.every((s) => s.category === 'Class')).toBe(true)
    }

    const nonIdentifying = TAG_RULES.find(
      (r) => r.slug === 'non-identifying-relationship',
    )
    expect(
      nonIdentifying,
      'missing rule non-identifying-relationship',
    ).toBeDefined()
    const matches = samples.filter((s) => nonIdentifying?.test(s))
    expect(matches.every((s) => s.category === 'ER')).toBe(true)
  })
})
