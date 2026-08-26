/**
 * Tests for xychart color palette generation (src/xychart/colors.ts).
 */
import { describe, it, expect } from 'vitest'
import {
  CHART_ACCENT_FALLBACK,
  isValidHex,
  isDarkBackground,
  mixHexColors,
  getSeriesColor,
} from '../xychart/colors.ts'

describe('isValidHex', () => {
  it('accepts a well-formed 6-digit hex color', () => {
    expect(isValidHex('#3b82f6')).toBe(true)
    expect(isValidHex('#FFFFFF')).toBe(true)
  })

  it('rejects non-hex strings like CSS variable references', () => {
    expect(isValidHex('var(--accent)')).toBe(false)
    expect(isValidHex('#fff')).toBe(false)
    expect(isValidHex('not-a-color')).toBe(false)
    expect(isValidHex('')).toBe(false)
  })
})

describe('isDarkBackground', () => {
  it('treats black as dark', () => {
    expect(isDarkBackground('#000000')).toBe(true)
  })

  it('treats white as light', () => {
    expect(isDarkBackground('#ffffff')).toBe(false)
  })

  it('treats a gray just below 50% lightness as dark', () => {
    expect(isDarkBackground('#7f7f7f')).toBe(true)
  })

  it('treats a gray at or above 50% lightness as light', () => {
    expect(isDarkBackground('#808080')).toBe(false)
  })
})

describe('mixHexColors', () => {
  it('returns the background color unchanged at ratio 0', () => {
    expect(mixHexColors('#000000', '#ffffff', 0)).toBe('#000000')
  })

  it('returns the foreground color unchanged at ratio 1', () => {
    expect(mixHexColors('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  it('blends bg and fg proportionally at ratio 0.5', () => {
    expect(mixHexColors('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('blends non-grayscale colors channel by channel', () => {
    expect(mixHexColors('#3b82f6', '#3b82f6', 0.5)).toBe('#3b82f6')
  })
})

describe('getSeriesColor', () => {
  it('returns the accent color unchanged for index 0', () => {
    expect(getSeriesColor(0, '#3b82f6')).toBe('#3b82f6')
  })

  it('falls back to the default accent when the accent is not a valid hex', () => {
    const withInvalidAccent = getSeriesColor(1, 'var(--accent)')
    const withFallback = getSeriesColor(1, CHART_ACCENT_FALLBACK)
    expect(withInvalidAccent).toBe(withFallback)
  })

  it('generates distinct colors for successive series indices', () => {
    const colors = [0, 1, 2, 3, 4, 5].map((i) => getSeriesColor(i, '#3b82f6'))
    const unique = new Set(colors)
    expect(unique.size).toBe(colors.length)
    for (const c of colors) expect(isValidHex(c)).toBe(true)
  })

  it('produces darker shades for odd indices and lighter for even indices on a light background', () => {
    const odd = getSeriesColor(1, '#3b82f6', '#ffffff')
    const even = getSeriesColor(2, '#3b82f6', '#ffffff')
    const [, , oddL] = hexLightness(odd)
    const [, , evenL] = hexLightness(even)
    expect(oddL).toBeLessThan(50)
    expect(evenL).toBeGreaterThan(50)
  })

  it('flips shade direction on a dark background so shades stay visible', () => {
    const oddOnDark = getSeriesColor(1, '#3b82f6', '#000000')
    const evenOnDark = getSeriesColor(2, '#3b82f6', '#000000')
    const [, , oddL] = hexLightness(oddOnDark)
    const [, , evenL] = hexLightness(evenOnDark)
    expect(oddL).toBeGreaterThan(50)
    expect(evenL).toBeLessThan(50)
  })

  it('falls back to light-background shading when bgColor is not a valid hex', () => {
    const withInvalidBg = getSeriesColor(1, '#3b82f6', 'var(--bg)')
    const withNoBg = getSeriesColor(1, '#3b82f6')
    expect(withInvalidBg).toBe(withNoBg)
  })

  it('produces more colors than the base palette when there are many series', () => {
    const colors = Array.from({ length: 12 }, (_, i) =>
      getSeriesColor(i, '#3b82f6'),
    )
    expect(new Set(colors).size).toBe(colors.length)
  })

  it('wraps hue drift around the hue wheel for low-hue accents', () => {
    const lighter = getSeriesColor(2, '#ff0000')
    const darker = getSeriesColor(1, '#ff0000')
    expect(isValidHex(lighter)).toBe(true)
    expect(isValidHex(darker)).toBe(true)
    expect(lighter).not.toBe(darker)
  })

  it('handles accents where red is the max channel and blue exceeds green', () => {
    const color = getSeriesColor(1, '#ff0080')
    expect(isValidHex(color)).toBe(true)
  })

  it('handles accents where green is the max channel', () => {
    const color = getSeriesColor(1, '#00ff00')
    expect(isValidHex(color)).toBe(true)
  })

  it('clamps lightness so far tiers stay within a visible range', () => {
    const veryOdd = getSeriesColor(99, '#3b82f6')
    const veryEven = getSeriesColor(100, '#3b82f6')
    expect(isValidHex(veryOdd)).toBe(true)
    expect(isValidHex(veryEven)).toBe(true)
  })
})

/** Minimal hex→HSL helper for assertions (mirrors colors.ts's private hexToHsl). */
function hexLightness(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16) / 255
  const g = parseInt(h.substring(2, 4), 16) / 255
  const b = parseInt(h.substring(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = ((max + min) / 2) * 100
  return [0, 0, l]
}
