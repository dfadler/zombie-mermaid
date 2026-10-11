import { describe, it, expect } from 'vitest'
import { f } from '../render-utils.ts'

describe('f tagged template literal', () => {
  it('rounds floats to 2 decimal places', () => {
    expect(f`${3.14159}`).toBe('3.14')
    expect(f`${0.1 + 0.2}`).toBe('0.3')
    expect(f`${1.005}`).toBe('1')
    expect(f`${1.1}`).toBe('1.1')
    expect(f`${2.0}`).toBe('2')
    expect(f`M ${'A'} ${3.14159} L ${10.5} ${-20.999}`).toBe(
      'M A 3.14 L 10.5 -21',
    )
  })

  it('keeps integers unchanged', () => {
    expect(f`${42}`).toBe('42')
    expect(f`${0}`).toBe('0')
    expect(f`${-7}`).toBe('-7')
  })

  it('passes non-number values through as-is', () => {
    expect(f`hello ${'world'}`).toBe('hello world')
    expect(f`${'foo'}bar`).toBe('foobar')
    expect(f`just text`).toBe('just text')
    expect(f`${true}`).toBe('true')
    expect(f`${null}`).toBe('null')
    expect(f`${undefined}`).toBe('undefined')
  })

  it('normalizes -0 to 0', () => {
    expect(f`${-0}`).toBe('0')
    expect(f`${-0.001}`).toBe('0')
  })

  it('rounds very small magnitudes down to 0 rather than emitting scientific notation', () => {
    expect(f`${1e-10}`).toBe('0')
    expect(f`${-1e-10}`).toBe('0')
  })

  it('normalizes non-finite values to 0 instead of emitting invalid SVG tokens', () => {
    // Reachable from degenerate zero-size geometry (e.g. a zero-length
    // vector normalized by dividing by its own length). "NaN"/"Infinity"
    // are not valid SVG numeric attribute values, unlike upstream's
    // behavior of stringifying them literally.
    expect(f`${NaN}`).toBe('0')
    expect(f`${Infinity}`).toBe('0')
    expect(f`${-Infinity}`).toBe('0')
    expect(f`<rect x="${NaN}" width="${10.5}" />`).toBe(
      '<rect x="0" width="10.5" />',
    )
  })

  it('handles multiple interpolations mixing rounded and passthrough values', () => {
    expect(
      f`<rect x="${1.005}" y="${-20.999}" fill="${'red'}" data-n="${5}" />`,
    ).toBe('<rect x="1" y="-21" fill="red" data-n="5" />')
  })
})
