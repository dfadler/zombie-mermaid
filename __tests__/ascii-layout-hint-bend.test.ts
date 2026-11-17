/**
 * `AsciiEdgeHint.bend`: where ELK's route bends along the flow axis, as a
 * fraction from its start face to its end face (#3205).
 */
import { describe, expect, it } from 'vitest'
import { bendOf, buildHints } from '../src/ascii-layout-provider.ts'

const pt = (x: number, y: number) => ({ x, y })

describe('bendOf', () => {
  it('is small for a Z that bends beside its source and large beside its target', () => {
    expect(
      bendOf([pt(0, 0), pt(20, 0), pt(20, 50), pt(200, 50)], true),
    ).toBeCloseTo(0.1)
    expect(
      bendOf([pt(0, 0), pt(180, 0), pt(180, 50), pt(200, 50)], true),
    ).toBeCloseTo(0.9)
  })

  it('reads the longest cross-axis run, and the flow axis of a vertical flow', () => {
    expect(
      bendOf(
        [
          pt(0, 0),
          pt(40, 0),
          pt(40, 10),
          pt(100, 10),
          pt(100, 90),
          pt(200, 90),
        ],
        true,
      ),
    ).toBeCloseTo(0.5)
    expect(
      bendOf([pt(0, 0), pt(0, 20), pt(60, 20), pt(60, 200)], false),
    ).toBeCloseTo(0.1)
  })

  it('counts from the first point whichever way the route runs', () => {
    expect(
      bendOf([pt(200, 0), pt(180, 0), pt(180, 50), pt(0, 50)], true),
    ).toBeCloseTo(0.1)
  })

  it('has none for a straight stroke, a route with no cross-axis run, or no flow-axis span', () => {
    expect(bendOf([pt(0, 0), pt(100, 0)], true)).toBeUndefined()
    expect(bendOf([pt(0, 0), pt(50, 10), pt(100, 20)], true)).toBeUndefined()
    expect(bendOf([pt(0, 0), pt(0, 40), pt(0, 80)], true)).toBeUndefined()
  })

  it('stays within 0 and 1 when the run lies outside the start and end', () => {
    expect(bendOf([pt(0, 0), pt(-30, 0), pt(-30, 50), pt(100, 50)], true)).toBe(
      0,
    )
    expect(bendOf([pt(0, 0), pt(150, 0), pt(150, 50), pt(100, 50)], true)).toBe(
      1,
    )
  })
})

describe('buildHints', () => {
  it('carries the bend of a bent route and omits it for a straight one', () => {
    const boxes = [
      { id: 'a', cx: 30, cy: 20, w: 60, h: 40 },
      { id: 'b', cx: 230, cy: 120, w: 60, h: 40 },
    ]
    const bent = buildHints(
      boxes,
      [
        {
          from: 'a',
          to: 'b',
          points: [pt(60, 20), pt(80, 20), pt(80, 120), pt(200, 120)],
        },
      ],
      'LR',
    )
    expect(bent.edges[0]!.bend).toBeCloseTo(20 / 140)
    const straight = buildHints(
      boxes,
      [{ from: 'a', to: 'b', points: [pt(60, 20), pt(200, 20)] }],
      'LR',
    )
    expect(straight.edges[0]).not.toHaveProperty('bend')
  })

  it('takes the real-size route’s bend only when it is the gap’s middle', () => {
    const boxes = [
      { id: 'a', cx: 30, cy: 20, w: 60, h: 40 },
      { id: 'b', cx: 230, cy: 120, w: 60, h: 40 },
    ]
    const legacy = [pt(60, 20), pt(80, 20), pt(80, 120), pt(200, 120)] // 0.14
    const bendFor = (bendPoints?: { x: number; y: number }[]) =>
      buildHints(
        boxes,
        [{ from: 'a', to: 'b', points: legacy, bendPoints }],
        'LR',
      ).edges[0]!.bend
    // Middle: taken.
    expect(
      bendFor([pt(60, 20), pt(130, 20), pt(130, 120), pt(200, 120)]),
    ).toBeCloseTo(0.5)
    // Elsewhere (a jog at a cluster border, say): the legacy bend stays.
    expect(
      bendFor([pt(60, 20), pt(160, 20), pt(160, 120), pt(200, 120)]),
    ).toBeCloseTo(20 / 140)
    // No real-size route, or one with no bend: the legacy bend stays.
    expect(bendFor(undefined)).toBeCloseTo(20 / 140)
    expect(bendFor([pt(60, 20), pt(200, 20)])).toBeCloseTo(20 / 140)
  })
})
