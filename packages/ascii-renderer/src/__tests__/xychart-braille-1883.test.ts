import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const LINE = `xychart-beta
  x-axis [A, B, C, D]
  line [1, 5, 2, 8]`
const opts = { colorMode: 'none' as const }
const BRAILLE = /[⠀-⣿]/

describe('xychart braille line series (#1883)', () => {
  it('is off by default: output identical with braille false/unset', () => {
    const base = renderMermaidASCII(LINE, opts)
    expect(renderMermaidASCII(LINE, { ...opts, braille: false })).toBe(base)
    expect(base).not.toMatch(BRAILLE)
  })

  it('draws the line as braille dots instead of the staircase', () => {
    const out = renderMermaidASCII(LINE, { ...opts, braille: true })
    expect(out).toMatch(BRAILLE)
    expect(out).not.toMatch(/[╭╮╰╯]/)
    expect(out).toMatchSnapshot()
  })

  it('keeps bars as blocks and ignores braille with useAscii', () => {
    const mixed = `xychart-beta
  x-axis [A, B]
  bar [3, 6]
  line [2, 5]`
    expect(renderMermaidASCII(mixed, { ...opts, braille: true })).toContain('█')
    expect(
      renderMermaidASCII(mixed, { ...opts, braille: true, useAscii: true }),
    ).toBe(renderMermaidASCII(mixed, { ...opts, useAscii: true }))
  })

  it('ignores braille on horizontal charts and pie', () => {
    const h = `xychart-beta horizontal
  x-axis [A, B]
  line [2, 5]`
    const pie = `pie\n  "a" : 1\n  "b" : 2`
    for (const src of [h, pie]) {
      expect(renderMermaidASCII(src, { ...opts, braille: true })).toBe(
        renderMermaidASCII(src, opts),
      )
    }
  })

  it.each([
    ['a flat series', 'x-axis [A, B, C]\n  line [3, 3, 3]'],
    ['a single point', 'x-axis [A]\n  line [3]'],
    [
      'a series beside bars',
      'x-axis [A, B, C]\n  bar [1, 4, 2]\n  line [2, 2, 9]',
    ],
  ])('renders %s without throwing and still draws dots', (_n, body) => {
    const out = renderMermaidASCII(`xychart-beta\n  ${body}`, {
      ...opts,
      braille: true,
    })
    expect(out).toMatch(BRAILLE)
  })
})
