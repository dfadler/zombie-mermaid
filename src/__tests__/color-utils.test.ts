import { describe, it, expect } from 'vitest'
import {
  parseCssColor,
  parseHexColor,
  mixSrgb,
  mixHexColors,
  formatCssColor,
} from '../color-utils.ts'

describe('parseCssColor', () => {
  it('parses 3/4/6/8-digit hex, expanding shorthand and reading alpha', () => {
    expect(parseCssColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseCssColor('#f008')).toEqual({
      r: 255,
      g: 0,
      b: 0,
      a: 0x88 / 255,
    })
    expect(parseCssColor('#27272A')).toEqual({ r: 39, g: 39, b: 42, a: 1 })
    expect(parseCssColor('#00000080')).toEqual({
      r: 0,
      g: 0,
      b: 0,
      a: 0x80 / 255,
    })
  })

  it('parses rgb()/rgba() in legacy comma and modern space syntax', () => {
    expect(parseCssColor('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3, a: 1 })
    expect(parseCssColor('rgba(1, 2, 3, 0.5)')).toEqual({
      r: 1,
      g: 2,
      b: 3,
      a: 0.5,
    })
    expect(parseCssColor('rgb(10 20 30 / 50%)')).toEqual({
      r: 10,
      g: 20,
      b: 30,
      a: 0.5,
    })
    expect(parseCssColor('rgb(100%, 0%, 50%)')).toEqual({
      r: 255,
      g: 0,
      b: 127.5,
      a: 1,
    })
  })

  it('parses the transparent keyword', () => {
    expect(parseCssColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 })
    expect(parseCssColor('  Transparent ')).toEqual({ r: 0, g: 0, b: 0, a: 0 })
  })

  it('returns null for anything it cannot evaluate rather than guessing', () => {
    expect(parseCssColor('var(--fg)')).toBeNull()
    expect(parseCssColor('red')).toBeNull()
    expect(parseCssColor('hsl(0 100% 50%)')).toBeNull()
    expect(parseCssColor('#ggg')).toBeNull()
    expect(parseCssColor('color-mix(in srgb, #000, #fff)')).toBeNull()
    expect(parseCssColor('')).toBeNull()
  })
})

describe('parseHexColor', () => {
  it('returns RGB tuple for hex literals and null otherwise', () => {
    expect(parseHexColor('#abc')).toEqual([170, 187, 204])
    expect(parseHexColor('#aabbccdd')).toEqual([170, 187, 204])
    expect(parseHexColor('rgb(1,2,3)')).toBeNull()
  })
})

describe('mixSrgb', () => {
  const black = { r: 0, g: 0, b: 0, a: 1 }
  const white = { r: 255, g: 255, b: 255, a: 1 }
  const transparent = { r: 0, g: 0, b: 0, a: 0 }

  it('defaults to 50/50 when both percentages are omitted', () => {
    expect(mixSrgb(black, white)).toEqual({
      r: 127.5,
      g: 127.5,
      b: 127.5,
      a: 1,
    })
  })

  it('infers the omitted percentage as 100 minus the given one', () => {
    expect(mixSrgb(black, white, 25)).toEqual({
      r: 191.25,
      g: 191.25,
      b: 191.25,
      a: 1,
    })
    expect(mixSrgb(black, white, undefined, 25)).toEqual({
      r: 63.75,
      g: 63.75,
      b: 63.75,
      a: 1,
    })
  })

  it('normalizes percentages that sum to more than 100', () => {
    // 150 + 50 → 75% / 25%
    expect(mixSrgb(black, white, 150, 50)).toEqual({
      r: 63.75,
      g: 63.75,
      b: 63.75,
      a: 1,
    })
  })

  it('scales alpha by the sum when percentages sum to less than 100', () => {
    // 25 + 25 → 50/50 blend at alpha 0.5
    expect(mixSrgb(black, white, 25, 25)).toEqual({
      r: 127.5,
      g: 127.5,
      b: 127.5,
      a: 0.5,
    })
  })

  it('interpolates in premultiplied alpha, so fading toward transparent keeps the hue', () => {
    const red = { r: 255, g: 0, b: 0, a: 1 }
    const mixed = mixSrgb(red, transparent, 20)
    expect(mixed).toEqual({ r: 255, g: 0, b: 0, a: 0.2 })
  })

  it('returns null when both percentages are zero (invalid per spec)', () => {
    expect(mixSrgb(black, white, 0, 0)).toBeNull()
  })
})

describe('mixHexColors', () => {
  it('mixes fg into bg at the given percentage, matching the ASCII bridge’s historical math', () => {
    // 0*.5 + 255*.5 = 127.5 → rounds to 128 = 0x80
    expect(mixHexColors('#000000', '#ffffff', 50)).toBe('#808080')
    // 0*.85 + 255*.15 = 38.25 → 38 = 0x26
    expect(mixHexColors('#000000', '#ffffff', 85)).toBe('#262626')
  })

  it('returns fg unchanged when either side is not a concrete color', () => {
    expect(mixHexColors('var(--fg)', '#fff', 50)).toBe('var(--fg)')
    expect(mixHexColors('#000', 'var(--bg)', 50)).toBe('#000')
  })
})

describe('formatCssColor', () => {
  it('emits #rrggbb for opaque colors and rgba() otherwise', () => {
    expect(formatCssColor({ r: 255, g: 0, b: 128, a: 1 })).toBe('#ff0080')
    expect(formatCssColor({ r: 39, g: 39, b: 42, a: 0.2 })).toBe(
      'rgba(39, 39, 42, 0.2)',
    )
  })

  it('rounds channels and clamps out-of-range values', () => {
    expect(formatCssColor({ r: 127.5, g: -3, b: 300, a: 1 })).toBe('#8000ff')
    expect(formatCssColor({ r: 0, g: 0, b: 0, a: 1.5 })).toBe('#000000')
    expect(formatCssColor({ r: 0, g: 0, b: 0, a: 0.33333 })).toBe(
      'rgba(0, 0, 0, 0.333)',
    )
  })
})
