/**
 * Tests for xychart color palette generation
 * (packages/mermaid-parser/src/xychart/colors.ts).
 */
import { describe, it, expect } from 'vitest'
import {
  CHART_ACCENT_FALLBACK,
  isValidHex,
  isDarkBackground,
  getSeriesColor,
} from '@zombie-mermaid/mermaid-parser'

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

describe('first-three-series separation (#1244)', () => {
  // CIE76 ΔE between two sRGB hex colors.
  function lab(hex: string): [number, number, number] {
    const lin = (i: number) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    const [r, g, b] = [lin(1), lin(3), lin(5)] as const
    const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    const f = (t: number) =>
      t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
  }
  const deltaE = (a: string, b: string) => {
    const [l1, a1, b1] = lab(a)
    const [l2, a2, b2] = lab(b)
    return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
  }

  // The pre-fix palette had ΔE 9 between series 0 and 2 (two similar blues).
  for (const bg of ['#ffffff', '#1a1b26']) {
    it(`keeps series 0, 1 and 2 at least 25 ΔE apart on ${bg}`, () => {
      const c0 = getSeriesColor(0, '#3b82f6', bg)
      const c1 = getSeriesColor(1, '#3b82f6', bg)
      const c2 = getSeriesColor(2, '#3b82f6', bg)
      expect(deltaE(c0, c1)).toBeGreaterThanOrEqual(25)
      expect(deltaE(c0, c2)).toBeGreaterThanOrEqual(25)
      expect(deltaE(c1, c2)).toBeGreaterThanOrEqual(25)
    })
  }
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
