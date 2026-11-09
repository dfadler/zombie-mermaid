/**
 * Sankey ASCII/Unicode rendering: the flow list, bars, values, units and
 * charsets. Whole-output goldens live in testdata/*\/sankey_*.txt.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (text: string, useAscii = false) =>
  renderMermaidASCII(text, { colorMode: 'none', useAscii })

describe('sankey ASCII', () => {
  it('lists each source with a bar per outgoing flow, scaled to the largest', () => {
    expect(render('sankey-beta\nA,B,10\nA,C,5\nB,D,10')).toBe(
      [
        'A  15',
        '  ├─▶ B  ████████████████████   10',
        '  └─▶ C  ██████████              5',
        'B  10',
        '  └─▶ D  ████████████████████   10',
      ].join('\n'),
    )
  })

  it('uses plain characters in ASCII mode', () => {
    expect(render('sankey-beta\nA,B,4\nA,C,1', true)).toBe(
      [
        'A  5',
        '  +-> B  ####################   4',
        '  `-> C  #####                  1',
      ].join('\n'),
    )
  })

  it('shows a thin bar for a flow too small for a cell', () => {
    expect(render('sankey-beta\nA,B,1000\nA,C,1')).toContain('C  ▏')
  })

  it('draws no bar for a zero flow', () => {
    expect(render('sankey-beta\nA,B,0\nA,C,5')).toMatch(/B {2}\s+0/)
  })

  it('applies prefix and suffix and can hide the values', () => {
    const cfg = (extra: string) =>
      `%%{init: {"sankey": {${extra}}}}%%\nsankey-beta\nA,B,2`
    expect(render(cfg('"prefix": "$", "suffix": "k"'))).toContain('A  $2k')
    expect(render(cfg('"prefix": "$", "suffix": "k"'))).toContain('  $2k')
    const hidden = render(cfg('"showValues": false'))
    expect(hidden).toBe('A\n  └─▶ B  ████████████████████')
  })

  it('paints bars in colour modes', () => {
    const out = renderMermaidASCII('sankey-beta\nA,B,1', {
      colorMode: 'truecolor',
    })
    expect(out).toContain('\u001b[')
  })

  it('throws "circular link" for a cycle', () => {
    expect(() => render('sankey-beta\nA,B,1\nB,A,1')).toThrow(/circular link/)
  })
})
