/**
 * Timeline ASCII/Unicode rendering: the spine, marker rows, sections, label
 * wrapping and charsets. Whole-output goldens live in testdata/*\/timeline_*.txt.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (text: string, useAscii = false) =>
  renderMermaidASCII(text, { colorMode: 'none', useAscii })

describe('timeline ASCII', () => {
  it('right-aligns periods on a spine with their events beside it', () => {
    expect(render('timeline\n2002 : LinkedIn\n2004 : Facebook : Google')).toBe(
      [
        '  2002 ──●── LinkedIn',
        '         │',
        '  2004 ──●── Facebook',
        '         │   Google',
        '         ▼',
      ].join('\n'),
    )
  })

  it('uses plain characters in ASCII mode', () => {
    const out = render('timeline\n1 : a\n2', true)
    expect(out).toBe(
      ['  1 --o-- a', '      |', '  2 --o--', '      v'].join('\n'),
    )
  })

  it('centres the title over the drawing', () => {
    const out = render('timeline\ntitle T\n2002 : LinkedIn').split('\n')
    expect(out[0]!.trim()).toBe('T')
    expect(out[1]).toBe('')
  })

  it('prints section headings and skips periods outside every section', () => {
    const out = render('timeline\norphan : e\nsection S\na : b')
    expect(out).toContain('[S]')
    expect(out).not.toContain('orphan')
  })

  it('wraps long period labels above the spine rows', () => {
    const out = render('timeline\nA very long period label that wraps : e')
    expect(out).toContain('A very long period label ──●── e')
    expect(out).toContain('that wraps')
  })

  it('draws only the arrow for a bare timeline', () => {
    expect(render('timeline')).toBe('     │\n     ▼')
  })

  it('renders timeline TD the same way', () => {
    expect(render('timeline TD\n1 : a')).toBe(render('timeline\n1 : a'))
  })

  it('paints markers in colour modes', () => {
    const out = renderMermaidASCII('timeline\n1 : a', {
      colorMode: 'truecolor',
    })
    expect(out).toContain('\u001b[')
  })
})
