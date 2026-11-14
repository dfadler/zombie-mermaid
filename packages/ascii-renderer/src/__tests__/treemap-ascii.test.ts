/**
 * Treemap ASCII/Unicode rendering: the indented tree, values, bars and
 * charsets. Whole-output goldens live in __tests__/__ascii-snapshots__.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (text: string, useAscii = false) =>
  renderMermaidASCII(text, { colorMode: 'none', useAscii })

const SRC = `treemap-beta
"Products"
    "Electronics"
        "Phones": 800
        "Laptops": 600
    "Clothing"
        "Men": 300
        "Women": 400
"Services": 200`

describe('treemap ASCII', () => {
  it('lists the tree largest first with totals and share bars', () => {
    expect(render(SRC)).toBe(
      [
        'Products        2,100  ██████████████████',
        '├─ Electronics  1,400  ████████████',
        '│  ├─ Phones      800  ██████▏',
        '│  └─ Laptops     600  █████',
        '└─ Clothing       700  ██████',
        '   ├─ Women       400  ███',
        '   └─ Men         300  ██▏',
        'Services          200  █▏',
      ].join('\n'),
    )
  })

  it('uses plain characters in ASCII mode', () => {
    const out = render('treemap-beta\n"A"\n  "B": 3\n  "C": 1', true)
    expect(out).toBe(
      [
        'A     4  ####################',
        '+- B  3  ###############',
        '`- C  1  #####',
      ].join('\n'),
    )
  })

  it('shows a thin bar for a share too small for a cell and none for zero', () => {
    const out = render('treemap-beta\n"A": 1000\n"B": 1\n"C": 0')
    expect(out).toContain('B      1  ▏')
    expect(out.split('\n')[2]).toMatch(/^C\s+0$/)
  })

  it('centres a title over the list and keeps a multi-line name on one row', () => {
    const out = render('treemap-beta\ntitle Spend\n"Rent": 5')
    expect(out.split('\n')[0]).toMatch(/^\s*Spend$/)
    expect(out.split('\n')[1]).toBe('')
  })

  it('returns just the title for an empty treemap', () => {
    expect(render('treemap-beta\ntitle Nothing')).toBe('Nothing')
    expect(render('treemap-beta\n')).toBe('')
  })
})
