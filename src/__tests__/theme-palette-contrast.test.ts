/**
 * Guards the "legible, readable contrast" acceptance criterion the #684
 * theme-selector restoration's 16 per-theme verification sub-issues
 * (#691-706) each individually ask for, systematically across every
 * built-in theme at once rather than eyeballing 16 screenshots one at a
 * time — see docs/decisions/theme-selector-shared-state.md and this
 * repo's CLAUDE.md's "favor tooling over manual scanning" convention.
 *
 * Computes the actual WCAG 2.x contrast ratio (relative luminance, per
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance) between each
 * theme's `bg`/`fg` pair — not a hand-picked pass/fail per theme, so a
 * future THEMES addition with a genuinely illegible pair fails this test
 * automatically instead of only being caught by a human noticing a
 * screenshot looks wrong.
 */
import { describe, it, expect } from 'vitest'
import { THEMES } from '@zombie-mermaid/core'

/**
 * The threshold every theme must clear. WCAG AA's own thresholds are 4.5:1
 * for normal text and 3:1 for large/bold text; diagram node labels here
 * are typically medium, semi-bold text, closer to the "large text"
 * category than dense body copy. 4.0 sits between the two -- strict enough
 * to catch a genuinely illegible pair, loose enough not to fail
 * `solarized-light` (4.13:1), whose muted bg/fg pair matches Ethan
 * Schoonover's actual published Solarized values rather than being a
 * mistake in this repo's THEMES data -- #684's own non-goals rule out
 * changing THEMES' colors to "fix" a curated editor-theme's real values.
 */
const MIN_CONTRAST_RATIO = 4.0

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ]
}

/** sRGB channel -> linear-light value, the WCAG relative-luminance step. */
function linearize(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

/** WCAG contrast ratio between two colors, always >= 1 (order-independent). */
function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA)
  const lumB = relativeLuminance(hexB)
  const lighter = Math.max(lumA, lumB)
  const darker = Math.min(lumA, lumB)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('every built-in theme has a legible bg/fg contrast ratio', () => {
  for (const [themeKey, colors] of Object.entries(THEMES)) {
    it(`${themeKey}: bg/fg contrast is at least ${MIN_CONTRAST_RATIO}:1`, () => {
      const ratio = contrastRatio(colors.bg, colors.fg)
      expect(ratio).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO)
    })
  }
})

describe('contrastRatio() itself', () => {
  it('returns 1 for identical colors', () => {
    expect(contrastRatio('#808080', '#808080')).toBeCloseTo(1, 5)
  })

  it('returns 21 for pure black vs pure white (the WCAG maximum)', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
  })

  it('is symmetric regardless of argument order', () => {
    const a = contrastRatio('#1a1b26', '#a9b1d6')
    const b = contrastRatio('#a9b1d6', '#1a1b26')
    expect(a).toBeCloseTo(b, 10)
  })
})
