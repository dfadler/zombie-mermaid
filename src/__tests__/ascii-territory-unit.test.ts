import { describe, it, expect } from 'vitest'
import { allocateTerritory } from '../ascii/territory.ts'
import type { TerritoryGeometry } from '../ascii/territory.ts'

/**
 * Test items carry their own geometry so the accessor stays trivial and the
 * cases below read as pure geometry — which is the whole point of
 * `allocateTerritory` being storage-agnostic (issue #618).
 */
interface Item extends TerritoryGeometry {
  name: string
}

const item = (
  name: string,
  idealMid: number,
  start: number,
  end: number,
  rowStart = 0,
  rowEnd = 0,
): Item => ({ name, idealMid, start, end, rowStart, rowEnd })

const geom = (i: Item): TerritoryGeometry => i

const allocate = (items: readonly Item[]) => allocateTerritory(items, geom)

/** `{ left, right }` for `name`, for terser assertions. */
const bounds = (
  items: readonly Item[],
  name: string,
): { left: number; right: number } => {
  const target = items.find((i) => i.name === name)
  expect(target).toBeDefined()
  if (!target) throw new Error('unreachable')
  const t = allocate(items).get(target)
  expect(t).toBeDefined()
  if (!t) throw new Error('unreachable')
  return t
}

describe('allocateTerritory', () => {
  it('returns an empty map for no items', () => {
    expect(allocate([]).size).toBe(0)
  })

  it('leaves a lone item completely unconstrained', () => {
    const items = [item('only', 10, 5, 15)]
    expect(bounds(items, 'only')).toEqual({ left: -Infinity, right: Infinity })
  })

  it('has an entry for every item', () => {
    const items = [
      item('a', 0, 0, 10),
      item('b', 5, 1, 9),
      item('c', 50, 45, 55),
    ]
    const result = allocate(items)
    expect(result.size).toBe(3)
    for (const i of items) expect(result.has(i)).toBe(true)
  })

  it('leaves items whose natural spans do not overlap unconstrained', () => {
    // Same row, but the spans are disjoint — no contest, so no split.
    const items = [item('left', 5, 0, 9), item('right', 25, 20, 29)]
    expect(bounds(items, 'left')).toEqual({ left: -Infinity, right: Infinity })
    expect(bounds(items, 'right')).toEqual({ left: -Infinity, right: Infinity })
  })

  it('splits contested space at the midpoint of two overlapping items', () => {
    // Spans 0..14 and 5..19 overlap; midpoint of idealMid 7 and 12 is 9.
    const items = [item('a', 7, 0, 14), item('b', 12, 5, 19)]
    expect(bounds(items, 'a')).toEqual({ left: -Infinity, right: 9 })
    expect(bounds(items, 'b')).toEqual({ left: 10, right: Infinity })
  })

  it('gives each side of the split disjoint, adjacent bounds', () => {
    // The left item's `right` and the right item's `left` must differ by
    // exactly 1 (the `+1`), so the two territories touch without overlapping
    // — an off-by-one either way would double-book or waste a column.
    for (const [midA, midB] of [
      [7, 12],
      [7, 13],
      [0, 1],
      [100, 101],
    ]) {
      const items = [
        item('a', midA ?? 0, -50, 50),
        item('b', midB ?? 0, -50, 50),
      ]
      const a = bounds(items, 'a')
      const b = bounds(items, 'b')
      expect(b.left).toBe(a.right + 1)
    }
  })

  it('does not split items whose rows do not overlap', () => {
    // Identical spans, but drawn on rows that never intersect.
    const items = [
      item('top', 10, 0, 20, 0, 0),
      item('bottom', 12, 0, 20, 5, 5),
    ]
    expect(bounds(items, 'top')).toEqual({ left: -Infinity, right: Infinity })
    expect(bounds(items, 'bottom')).toEqual({
      left: -Infinity,
      right: Infinity,
    })
  })

  it('treats rows as inclusive, so a single shared row counts as overlap', () => {
    const items = [item('a', 10, 0, 20, 0, 3), item('b', 14, 0, 20, 3, 6)]
    expect(bounds(items, 'a').right).toBe(12)
    expect(bounds(items, 'b').left).toBe(13)
  })

  it('skips a non-colliding neighbour to reach the real competitor (issue #531)', () => {
    // `mid` sits between `a` and `c` by idealMid but on a different row, so
    // stopping at the immediate neighbour would leave a and c unsplit — the
    // exact regression #531 fixed.
    const items = [
      item('a', 10, 0, 30, 0, 0),
      item('mid', 20, 0, 30, 9, 9),
      item('c', 30, 0, 30, 0, 0),
    ]
    expect(bounds(items, 'a')).toEqual({ left: -Infinity, right: 20 })
    expect(bounds(items, 'c')).toEqual({ left: 21, right: Infinity })
    // The interloper collides with neither, so it keeps the full width.
    expect(bounds(items, 'mid')).toEqual({ left: -Infinity, right: Infinity })
  })

  it('constrains a middle item from both sides', () => {
    const items = [
      item('a', 0, 0, 30, 0, 0),
      item('b', 20, 0, 40, 0, 0),
      item('c', 40, 20, 60, 0, 0),
    ]
    expect(bounds(items, 'b')).toEqual({ left: 11, right: 30 })
  })

  it('is independent of the order items are supplied in', () => {
    const a = item('a', 7, 0, 14)
    const b = item('b', 12, 5, 19)
    const c = item('c', 30, 25, 39)
    const forward = allocateTerritory([a, b, c], geom)
    const shuffled = allocateTerritory([c, a, b], geom)
    for (const i of [a, b, c]) {
      expect(shuffled.get(i)).toEqual(forward.get(i))
    }
  })

  it('handles negative midpoints without flipping the split', () => {
    const items = [item('a', -12, -20, -5, 0, 0), item('b', -7, -14, 0, 0, 0)]
    const a = bounds(items, 'a')
    const b = bounds(items, 'b')
    // Math.floor rounds toward -Infinity, so this pins the intended
    // behaviour rather than a truncation-toward-zero variant.
    expect(a.right).toBe(-10)
    expect(b.left).toBe(-9)
  })

  it('calls the geometry accessor exactly once per item, in input order', () => {
    const items = [
      item('c', 30, 25, 39),
      item('a', 7, 0, 14),
      item('b', 12, 5, 19),
    ]
    const seen: string[] = []
    allocateTerritory(items, (i) => {
      seen.push(i.name)
      return i
    })
    expect(seen).toEqual(['c', 'a', 'b'])
  })

  it('keeps input order for items tying on idealMid (stable sort)', () => {
    // Two items share an idealMid; `first` was supplied first, so it stays
    // the left-hand side of the split. Reversing the input reverses which
    // one wins — proving order is decided by the stable sort, not by chance.
    const first = item('first', 10, 0, 20, 0, 0)
    const second = item('second', 10, 0, 20, 0, 0)
    const forward = allocateTerritory([first, second], geom)
    expect(forward.get(first)).toEqual({ left: -Infinity, right: 10 })
    expect(forward.get(second)).toEqual({ left: 11, right: Infinity })

    const reversed = allocateTerritory([second, first], geom)
    expect(reversed.get(second)).toEqual({ left: -Infinity, right: 10 })
    expect(reversed.get(first)).toEqual({ left: 11, right: Infinity })
  })

  it('splits every member of a dense same-row cluster', () => {
    const items = [
      item('a', 0, 0, 20, 0, 0),
      item('b', 10, 0, 20, 0, 0),
      item('c', 20, 0, 20, 0, 0),
      item('d', 30, 10, 30, 0, 0),
    ]
    const result = allocate(items)
    for (const i of items) {
      const t = result.get(i)
      expect(t).toBeDefined()
    }
    expect(bounds(items, 'a')).toEqual({ left: -Infinity, right: 5 })
    expect(bounds(items, 'b')).toEqual({ left: 6, right: 15 })
    expect(bounds(items, 'c')).toEqual({ left: 16, right: 25 })
    expect(bounds(items, 'd')).toEqual({ left: 26, right: Infinity })
  })

  it('treats spans touching at a single column as overlapping', () => {
    // a ends exactly where b starts — one shared column is still a contest.
    const items = [item('a', 5, 0, 10, 0, 0), item('b', 15, 10, 20, 0, 0)]
    expect(bounds(items, 'a').right).toBe(10)
    expect(bounds(items, 'b').left).toBe(11)
  })

  it('leaves spans that merely abut (no shared column) unconstrained', () => {
    const items = [item('a', 5, 0, 9, 0, 0), item('b', 15, 10, 20, 0, 0)]
    expect(bounds(items, 'a')).toEqual({ left: -Infinity, right: Infinity })
    expect(bounds(items, 'b')).toEqual({ left: -Infinity, right: Infinity })
  })
})
