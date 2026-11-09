/**
 * Packet ASCII/Unicode rendering: boxes, bit numbers, row cuts, truncation,
 * descending order and charsets. Whole-output goldens live in
 * testdata/*\/packet_*.txt.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (text: string, useAscii = false) =>
  renderMermaidASCII(text, { colorMode: 'none', useAscii })

describe('packet ASCII', () => {
  it('boxes each field with its bit range over its label', () => {
    expect(
      render(
        '%%{init: {"packet": {"bitsPerRow": 8}}}%%\npacket\n0-3: "a"\n4-7: "b"',
      ),
    ).toBe(
      [
        '┌───────┬───────┐',
        '│0     3│4     7│',
        '│   a   │   b   │',
        '└───────┴───────┘',
      ].join('\n'),
    )
  })

  it('uses plain characters in ASCII mode', () => {
    const out = render(
      '%%{init: {"packet": {"bitsPerRow": 4}}}%%\npacket\n0-3: "ab"',
      true,
    )
    expect(out).toMatch(/^\+-+\+\n\|0 +3\|\n\| +ab +\|\n\+-+\+$/)
  })

  it('joins rows of different shapes with the right junctions', () => {
    const out = render(
      '%%{init: {"packet": {"bitsPerRow": 4}}}%%\npacket\n0-1: "a"\n2-3: "b"\n4-7: "c"',
    ).split('\n')
    expect(out[3]).toMatch(/^├─+┴─+┤$/)
  })

  it('shows a lone one-bit number centred and drops numbers that do not fit', () => {
    const out = render('packet\n0: "x"\n1-31: "y"')
    expect(out).toContain('│0 │1')
    // A one-bit box three columns wide holds no three-digit number.
    const wide = render('packet\n0-99: "x"\n100: "y"\n101-127: "z"')
    expect(wide).toContain('99')
    expect(wide).not.toContain('100')
  })

  it('cuts a label that cannot fit with an ellipsis (~ in ASCII)', () => {
    const src = 'packet\n0-30: "x"\n31: "A long label"'
    expect(render(src)).toContain('A…')
    expect(render(src, true)).toContain('A~')
  })

  it('mirrors rows for bitOrder descending, high bit first', () => {
    const out = render(
      '%%{init: {"packet": {"bitsPerRow": 8, "bitOrder": "descending"}}}%%\npacket\n0-3: "lo"\n4-7: "hi"',
    ).split('\n')
    expect(out[1]).toMatch(/^│7 +4│3 +0│$/)
    expect(out[2]).toMatch(/hi.*lo/)
  })

  it('drops the number line with showBits false', () => {
    const out = render(
      '%%{init: {"packet": {"bitsPerRow": 4, "showBits": false}}}%%\npacket\n0-3: "ab"',
    ).split('\n')
    expect(out).toHaveLength(3)
  })

  it('centres the title and prints a title-only diagram as text', () => {
    expect(render('packet\ntitle Only')).toBe('Only')
    expect(render('packet')).toBe('')
    const out = render('packet\ntitle T\n0-31: "x"').split('\n')
    expect(out[0]!.trim()).toBe('T')
    expect(out[0]!.length).toBeGreaterThan(10)
  })

  it('repeats a field on every row it crosses', () => {
    const out = render(
      '%%{init: {"packet": {"bitsPerRow": 4}}}%%\npacket\n0-5: "ab"',
    )
    expect(out.match(/ab/g)).toHaveLength(2)
  })

  it('lines up wide characters', () => {
    const lines = render('packet\n0-15: "日本語"\n16-31: "😀"').split('\n')
    expect(
      lines.every(
        (l) =>
          l.length === lines[0]!.length || l.includes('日') || l.includes('😀'),
      ),
    ).toBe(true)
  })

  it('paints borders in colour modes', () => {
    expect(
      renderMermaidASCII('packet\n0: "a"', { colorMode: 'truecolor' }),
    ).toContain('\u001b[')
  })
})
