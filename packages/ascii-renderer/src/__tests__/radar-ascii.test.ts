/**
 * Radar ASCII/Unicode rendering: the ruler, bars, clipping, legend and
 * charsets. Whole-output goldens live in testdata/*\/radar_*.txt.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (text: string, useAscii = false) =>
  renderMermaidASCII(text, { colorMode: 'none', useAscii })

describe('radar ASCII', () => {
  it('draws one bar per curve under each axis, on a ruler', () => {
    const out = render(
      'radar-beta\naxis a, b\ncurve x["X"]{50, 100}\nmax 100\nticks 2',
    ).split('\n')
    expect(out[0]!.trim()).toBe('0' + ' '.repeat(36) + '100')
    expect(out[1]).toMatch(/^ +├─+┬─+┤$/)
    expect(out[2]).toBe('  a X ' + '█'.repeat(20) + '·'.repeat(20) + '  50')
    expect(out[3]).toBe('  b X ' + '█'.repeat(40) + '  100')
  })

  it('gives each curve its own fill, by position in the source', () => {
    const out = render('radar-beta\naxis a\ncurve x{1}\ncurve y{1}\nmax 1')
    expect(out).toContain('█')
    expect(out).toContain('▓')
  })

  it('uses plain characters in ASCII mode', () => {
    const out = render(
      'radar-beta\naxis a\ncurve x{1}\ncurve y{1}\nmax 1',
      true,
    )
    expect(out).toContain('#')
    expect(out).toContain('=')
    expect(out).toMatch(/\|-+[+-]*\|/)
    expect(out).not.toMatch(/[^\x00-\x7f]/)
  })

  it('clips values to min and max but prints the value written', () => {
    const out = render(
      'radar-beta\naxis a, b\ncurve x{5, 500}\nmin 10\nmax 100',
    )
    const rows = out.split('\n')
    expect(rows[2]).toBe('  a x ' + '·'.repeat(40) + '  5')
    expect(rows[3]).toBe('  b x ' + '█'.repeat(40) + '  500')
  })

  it('hides curve names with showLegend false', () => {
    expect(
      render('radar-beta\naxis a\ncurve x["Secret"]{1}\nshowLegend false'),
    ).not.toContain('Secret')
    expect(render('radar-beta\naxis a\ncurve x["Shown"]{1}')).toContain('Shown')
  })

  it('does not draw a curve with the wrong number of values', () => {
    const out = render(
      'radar-beta\naxis a, b\ncurve x["Short"]{1}\ncurve y["Full"]{1, 2}',
    )
    expect(out).not.toContain('Short')
    expect(out).toContain('Full')
  })

  it('centres the title over the drawing', () => {
    const out = render('radar-beta\ntitle T\naxis a\ncurve x{1}').split('\n')
    expect(out[0]!.trim()).toBe('T')
    expect(out[0]!.length).toBeGreaterThan(10)
    expect(out[1]).toBe('')
  })

  it('says so for a radar with no axes', () => {
    expect(render('radar-beta')).toBe('(no axes)')
  })

  it('lists axes alone when there are no curves', () => {
    expect(render('radar-beta\naxis a, b')).toBe('  a\n  b')
  })

  it('does not divide by zero when min equals max', () => {
    expect(() =>
      render('radar-beta\naxis a\ncurve x{5}\nmin 5\nmax 5'),
    ).not.toThrow()
  })

  it('paints bars in colour modes', () => {
    const out = renderMermaidASCII('radar-beta\naxis a\ncurve x{1}', {
      colorMode: 'truecolor',
    })
    expect(out).toContain('\u001b[')
  })
})
