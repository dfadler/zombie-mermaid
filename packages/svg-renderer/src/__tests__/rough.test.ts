import { describe, expect, it } from 'vitest'
import {
  roughLine,
  roughPathOutline,
  roughPathSolid,
  roughRectOutline,
} from '../rough.ts'

// Expected strings come from rough.js 4.6.6 itself (RoughGenerator, seed 42), the
// version mermaid@12.3.0 bundles, so these pin byte-for-byte parity with it.
describe('rough.js subset', () => {
  it('draws a double line like rough.line', () => {
    expect(roughLine(0, 0, 30, 40, 1.5, 42)).toBe(
      'M-2.992402793839574 -2.275261430069804 C6.9468089517205955 6.507135380897671, 9.80917244106531 18.234505069348963, 31.003536639735103 37.71713665314019 M-0.365930481813848 0.16971236374229193 C7.736099901236596 11.024816153291615, 18.396690041385593 23.006619756761943, 30.93641994986683 40.92740002181381',
    )
  })

  it('draws a rectangle outline like rough.rectangle', () => {
    const d = roughRectOutline(0, 0, 10, 8, 1.5, 42)
    expect(d.split('M')).toHaveLength(9) // Four sides, two strokes each
    expect(
      d.startsWith('M-1.496201396919787 -1.137630715034902 C2.429642696'),
    ).toBe(true)
  })

  it('outlines a quadratic path through its cubic form like rough.path', () => {
    const d = roughPathOutline('M 0 0 L 0 10 Q 20 0 0 0 Z', 1.5, 42)
    expect(d).toContain('M0 10 C15.074333361660441 1.1457007111360626,')
    expect(d.endsWith('M0 0 C0 0, 0 0, 0 0')).toBe(true)
  })

  it('splits a solid triangle into fill and outline like rough.path (fillStyle solid)', () => {
    const { fill, outline } = roughPathSolid('M 10 10 L -2 16 L -2 4 Z', 1, 42)
    expect(fill).toBe(
      'M9.67956824431636 7.800395536353022 C5.726846226603015 13.739052339420269, 1.8546090713923045 14.915342892026889, -3.3818194094265697 15.208629197784285 C-1.278123935207725 11.656491999030113, -2.888865936741233 7.551136908680199, -3.056015535444021 5.074088581651449 C0.7604191893917853 6.284041111767798, 1.8615150587052849 5.044916914092278, 9.967304864586456 11.152652320451645',
    )
    expect(
      outline.startsWith(
        'M8.661756787382885 8.982472155156106 C7.988893065997351',
      ),
    ).toBe(true)
  })

  it('is deterministic, treats seed 0 as a fixed seed, and varies with the seed', () => {
    expect(roughLine(0, 0, 9, 9, 1, 0)).toBe(roughLine(0, 0, 9, 9, 1, 0))
    expect(roughLine(0, 0, 9, 9, 1, 0)).toBe(roughLine(0, 0, 9, 9, 1, 1))
    expect(roughLine(0, 0, 9, 9, 1, 2)).not.toBe(roughLine(0, 0, 9, 9, 1, 3))
  })

  it('shortens the jitter on long lines (roughness gain)', () => {
    // 300 and 600 long lines take the interpolated and the 0.4 gain branches.
    expect(roughLine(0, 0, 300, 0, 1, 5)).toMatch(/^M/)
    expect(roughLine(0, 0, 600, 0, 1, 5)).toMatch(/^M/)
  })
})
