// `findFreeLane` (src/ascii/lane-search.ts) is the search algorithm that
// `er-diagram.ts`'s `chooseFreeRow` and `class-diagram.ts`'s
// `findClearColumn` independently grew, extracted in issue #617.
//
// Two kinds of test here:
//
//  1. Direct unit tests pinning the contract — search order, inclusive
//     bounds, the deliberately unbounded `preferred` probe, and the
//     `undefined` return that each caller turns into its own fallback.
//  2. Differential tests against verbatim copies of *both* pre-extraction
//     loops, over randomized occupancy. The extraction's acceptance bar is
//     byte-identical rendered output, and the rendered sample suite alone
//     doesn't reach every branch of either original search — so the
//     originals are kept here as reference implementations and the shared
//     function is required to agree with them on every generated input.
import { describe, it, expect } from 'vitest'
import { findFreeLane } from '../ascii/lane-search.ts'

describe('findFreeLane', () => {
  it('returns the preferred lane when it is free', () => {
    expect(findFreeLane(5, 0, 10, () => true)).toBe(5)
  })

  it('probes the preferred lane exactly once, before any bounds apply', () => {
    const probed: number[] = []
    // `preferred` sits outside [min, max] and is still tested — the ER
    // caller depends on this for a gap too narrow to hold a candidate.
    const result = findFreeLane(3, 10, 20, (c) => {
      probed.push(c)
      return c === 3
    })
    expect(result).toBe(3)
    expect(probed).toEqual([3])
  })

  it('scans forward before backward at each distance', () => {
    const probed: number[] = []
    findFreeLane(5, 0, 10, (c) => {
      probed.push(c)
      return false
    })
    expect(probed.slice(0, 7)).toEqual([5, 6, 4, 7, 3, 8, 2])
  })

  it('prefers the nearer free lane, forward winning a tie', () => {
    // Both 4 and 6 are free and equidistant from 5.
    expect(findFreeLane(5, 0, 10, (c) => c === 4 || c === 6)).toBe(6)
    // Backward-only: 4 is free, 6 is not.
    expect(findFreeLane(5, 0, 10, (c) => c === 4)).toBe(4)
    // A nearer backward lane beats a further forward one.
    expect(findFreeLane(5, 0, 10, (c) => c === 3 || c === 9)).toBe(3)
  })

  it('treats min and max as inclusive bounds on outward candidates', () => {
    expect(findFreeLane(5, 0, 7, (c) => c === 7)).toBe(7)
    expect(findFreeLane(5, 0, 6, (c) => c === 7)).toBeUndefined()
    expect(findFreeLane(5, 2, 10, (c) => c === 2)).toBe(2)
    expect(findFreeLane(5, 3, 10, (c) => c === 2)).toBeUndefined()
  })

  it('never calls the occupancy check on an out-of-range candidate', () => {
    const probed: number[] = []
    findFreeLane(5, 4, 6, (c) => {
      probed.push(c)
      return false
    })
    expect(probed).toEqual([5, 6, 4])
  })

  it('returns undefined when nothing in range is free', () => {
    expect(findFreeLane(5, 0, 10, () => false)).toBeUndefined()
  })

  it('returns undefined when the bounds leave no candidates at all', () => {
    // min > max — ER's narrow-gap case, where only `preferred` is probed.
    const probed: number[] = []
    const result = findFreeLane(5, 6, 4, (c) => {
      probed.push(c)
      return false
    })
    expect(result).toBeUndefined()
    expect(probed).toEqual([5])
  })

  it('searches far enough to reach whichever bound is further away', () => {
    expect(findFreeLane(5, 0, 100, (c) => c === 100)).toBe(100)
    expect(findFreeLane(95, 0, 100, (c) => c === 0)).toBe(0)
  })
})

// --- Differential tests against the pre-extraction implementations -------

/**
 * Deterministic 32-bit LCG. A fixed seed keeps a failure reproducible;
 * `Math.random` would make one impossible to re-run.
 */
function makeRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

/** `chooseFreeRow`'s search loop, copied verbatim from before #617. */
function legacyChooseRow(
  startY: number,
  endY: number,
  isRowFree: (y: number) => boolean,
): number {
  const preferred = Math.floor((startY + endY) / 2)
  if (isRowFree(preferred)) return preferred

  const maxOffset = endY - startY
  for (let d = 1; d <= maxOffset; d++) {
    const below = preferred + d
    if (below < endY && isRowFree(below)) return below
    const above = preferred - d
    if (above > startY && isRowFree(above)) return above
  }
  return preferred
}

/** `findClearColumn`'s search loop, copied verbatim from before #617. */
function legacyClearColumn(
  startX: number,
  totalW: number,
  isColumnClear: (x: number) => boolean,
): number {
  if (isColumnClear(startX)) return startX

  for (let offset = 1; offset < totalW + 10; offset++) {
    const rightX = startX + offset
    if (isColumnClear(rightX)) return rightX
    const leftX = startX - offset
    if (leftX >= 0 && isColumnClear(leftX)) return leftX
  }

  return totalW + 2
}

describe('findFreeLane matches the implementations it replaced', () => {
  it("reproduces chooseFreeRow's row search on randomized occupancy", () => {
    const rng = makeRng(0x5eed_617)
    for (let trial = 0; trial < 2000; trial++) {
      const startY = Math.floor(rng() * 20)
      const endY = startY + Math.floor(rng() * 20)
      // Density spans "almost everything free" to "almost nothing free" so
      // both the hit and the exhausted-fallback paths get exercised.
      const density = rng()
      const occupied = new Set<number>()
      for (let y = startY - 5; y <= endY + 5; y++) {
        if (rng() < density) occupied.add(y)
      }
      const isRowFree = (y: number): boolean => !occupied.has(y)

      const preferred = Math.floor((startY + endY) / 2)
      const extracted =
        findFreeLane(preferred, startY + 1, endY - 1, isRowFree) ?? preferred

      expect({ startY, endY, chosen: extracted }).toEqual({
        startY,
        endY,
        chosen: legacyChooseRow(startY, endY, isRowFree),
      })
    }
  })

  it("reproduces findClearColumn's column search on randomized occupancy", () => {
    const rng = makeRng(0xc01_5e5)
    for (let trial = 0; trial < 2000; trial++) {
      const totalW = 4 + Math.floor(rng() * 40)
      const startX = Math.floor(rng() * totalW)
      const density = rng()
      // Only columns within the canvas can be blocked by a box — past the
      // widest box every column is clear, which is why the original's
      // `totalW + 2` fallback was unreachable in practice.
      const blocked = new Set<number>()
      for (let x = 0; x < totalW; x++) {
        if (rng() < density) blocked.add(x)
      }
      const isColumnClear = (x: number): boolean => !blocked.has(x)

      const extracted =
        findFreeLane(startX, 0, startX + totalW + 9, isColumnClear) ??
        totalW + 2

      expect({ totalW, startX, chosen: extracted }).toEqual({
        totalW,
        startX,
        chosen: legacyClearColumn(startX, totalW, isColumnClear),
      })
    }
  })

  it("reproduces findClearColumn's fallback when every column is blocked", () => {
    // Not reachable through the real renderer (a column past the widest box
    // is always clear), but the fallback is still wired up — so pin the
    // agreement rather than leaving the branch untested.
    const totalW = 12
    const startX = 3
    const neverClear = (): boolean => false
    expect(
      findFreeLane(startX, 0, startX + totalW + 9, neverClear) ?? totalW + 2,
    ).toBe(legacyClearColumn(startX, totalW, neverClear))
  })
})
