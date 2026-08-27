/**
 * Guards the sample counts quoted in docs/guides/samples.md.
 *
 * Lives here rather than under src/__tests__ because it imports
 * samples-data.ts from the repo root, which sits outside tsconfig's
 * `rootDir: "src"` — importing it from library source fails `tsc --noEmit`
 * even though vitest runs it happily.
 */
import { describe, it, expect } from 'vitest'
import { samples } from '../samples-data.ts'

describe('docs/guides/samples.md sample counts', () => {
  /**
   * Pins the sample counts quoted in samples.md.
   *
   * The guide originally said 85, which is the total including the hero
   * banner; the browsable gallery is 84. Both numbers are true of different
   * things, which is exactly how a doc drifts into being wrong — so both are
   * asserted here alongside the per-category table.
   */
  it('quotes sample counts that match the data', () => {
    const byCategory = new Map<string, number>()
    for (const sample of samples) {
      const category = sample.category ?? 'Other'
      byCategory.set(category, (byCategory.get(category) ?? 0) + 1)
    }

    expect(samples.length, 'total including the hero banner').toBe(85)
    expect(
      samples.filter((s) => s.category !== 'Hero').length,
      'browsable gallery count quoted in the guide',
    ).toBe(84)

    // The category table in samples.md.
    expect(byCategory.get('Flowchart')).toBe(24)
    expect(byCategory.get('Sequence')).toBe(16)
    expect(byCategory.get('Class')).toBe(16)
    expect(byCategory.get('ER')).toBe(14)
    expect(byCategory.get('XY Chart')).toBe(10)
    expect(byCategory.get('State')).toBe(4)
  })
})
