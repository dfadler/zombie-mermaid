/**
 * Tests for `box <color?> <label?>` header parsing (#419).
 *
 * Mirrors Mermaid's `parseBoxData`: the leading word (or `rgb()`/`hsl()`
 * call) is a colour if it matches a known CSS colour form, otherwise the
 * whole header is the label. `transparent` is treated as "no colour".
 */
import { describe, it, expect } from 'vitest'
import { isCssColor, parseBoxHeader } from '../sequence/box-color.ts'

describe('isCssColor', () => {
  it('recognizes CSS named colours, case-insensitively', () => {
    expect(isCssColor('red')).toBe(true)
    expect(isCssColor('RED')).toBe(true)
    expect(isCssColor('rebeccapurple')).toBe(true)
    expect(isCssColor('notacolor')).toBe(false)
  })

  it('recognizes hex colours (3/4/6/8 digit)', () => {
    expect(isCssColor('#fff')).toBe(true)
    expect(isCssColor('#ffff')).toBe(true)
    expect(isCssColor('#ff00aa')).toBe(true)
    expect(isCssColor('#ff00aa80')).toBe(true)
    expect(isCssColor('#ff00a')).toBe(false)
    expect(isCssColor('#gggggg')).toBe(false)
  })

  it('recognizes rgb()/rgba()/hsl()/hsla() function forms', () => {
    expect(isCssColor('rgb(33,66,99)')).toBe(true)
    expect(isCssColor('rgba(33,66,99,0.5)')).toBe(true)
    expect(isCssColor('hsl(10, 40%, 90%)')).toBe(true)
    expect(isCssColor('hsla(10, 40%, 90%, 0.5)')).toBe(true)
    expect(isCssColor('rgb(33 66 99 / 50%)')).toBe(true)
  })

  it('does not treat "transparent" as a CSS colour on its own', () => {
    // transparent is handled separately by parseBoxHeader, not as a colour
    expect(isCssColor('transparent')).toBe(false)
  })
})

describe('parseBoxHeader', () => {
  it('splits a leading colour word from the rest as the label', () => {
    expect(parseBoxHeader('Aqua Group 1')).toEqual({
      color: 'Aqua',
      label: 'Group 1',
    })
  })

  it('treats the whole header as the label when the first word is not a colour', () => {
    expect(parseBoxHeader('Group 1')).toEqual({ label: 'Group 1' })
  })

  it('returns an empty label for an empty header', () => {
    expect(parseBoxHeader('')).toEqual({ label: '' })
  })

  it('treats a single colour word with nothing after it as colour-only (no label)', () => {
    expect(parseBoxHeader('red')).toEqual({ color: 'red', label: '' })
  })

  it('consumes "transparent" as "no colour" rather than as the label', () => {
    expect(parseBoxHeader('transparent Group 1')).toEqual({ label: 'Group 1' })
    expect(parseBoxHeader('transparent')).toEqual({ label: '' })
  })

  it('accepts a hex colour followed by a label', () => {
    expect(parseBoxHeader('#33001a Group 1')).toEqual({
      color: '#33001a',
      label: 'Group 1',
    })
  })

  it('accepts an rgb()/hsl() function colour followed by a label', () => {
    expect(parseBoxHeader('rgb(33,66,99) Group 1')).toEqual({
      color: 'rgb(33,66,99)',
      label: 'Group 1',
    })
  })
})
