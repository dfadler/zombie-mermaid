/**
 * Tests for the theme/color-math helpers in src/theme.ts.
 */
import { describe, it, expect } from 'vitest'
import { getReadableTextColor } from '../theme.ts'

describe('getReadableTextColor', () => {
  it('returns dark text for a light pastel fill (6-digit hex)', () => {
    expect(getReadableTextColor('#FF6B6B', 'var(--_text)')).toBe('#000000')
    expect(getReadableTextColor('#90EE90', 'var(--_text)')).toBe('#000000')
  })

  it('returns light text for a dark fill (6-digit hex)', () => {
    expect(getReadableTextColor('#111111', 'var(--_text)')).toBe('#FFFFFF')
    expect(getReadableTextColor('#000000', 'var(--_text)')).toBe('#FFFFFF')
  })

  it('handles 3-digit shorthand hex', () => {
    expect(getReadableTextColor('#fff', 'var(--_text)')).toBe('#000000')
    expect(getReadableTextColor('#000', 'var(--_text)')).toBe('#FFFFFF')
  })

  it('ignores alpha channel in 4/8-digit hex and uses RGB luminance', () => {
    expect(getReadableTextColor('#ffffffff', 'var(--_text)')).toBe('#000000')
    expect(getReadableTextColor('#000000ff', 'var(--_text)')).toBe('#FFFFFF')
  })

  it('falls back when fill is undefined', () => {
    expect(getReadableTextColor(undefined, 'var(--_text)')).toBe('var(--_text)')
  })

  it('falls back when fill is a CSS variable reference', () => {
    expect(getReadableTextColor('var(--surface)', 'var(--_text)')).toBe(
      'var(--_text)',
    )
  })

  it('falls back when fill is a named CSS color', () => {
    expect(getReadableTextColor('lightpink', 'var(--_text)')).toBe(
      'var(--_text)',
    )
  })

  it('falls back when fill is malformed or an injection attempt', () => {
    expect(
      getReadableTextColor('red" onmouseover="alert(1)', 'var(--_text)'),
    ).toBe('var(--_text)')
    expect(getReadableTextColor('#gggggg', 'var(--_text)')).toBe('var(--_text)')
  })
})
