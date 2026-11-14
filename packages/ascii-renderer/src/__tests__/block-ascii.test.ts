/**
 * Block ASCII/Unicode rendering: boxes, groups, spans, spaces and charsets.
 * Whole-output goldens live in testdata/*\/block_*.txt.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (text: string, useAscii = false) =>
  renderMermaidASCII(text, { colorMode: 'none', useAscii })

describe('block ASCII', () => {
  it('draws each block as a box in a row, centred', () => {
    expect(render('block-beta\n  a["Alpha"] b')).toBe(
      [
        '┌───────┐ ┌───────┐',
        '│ Alpha │ │   b   │',
        '└───────┘ └───────┘',
      ].join('\n'),
    )
  })

  it('wraps rows at `columns`, spans cells and leaves a space empty', () => {
    expect(render('block-beta\n  columns 2\n  a b\n  space c:1\n  d:2')).toBe(
      [
        '┌───┐ ┌───┐',
        '│ a │ │ b │',
        '└───┘ └───┘',
        '      ┌───┐',
        '      │ c │',
        '      └───┘',
        '┌─────────┐',
        '│    d    │',
        '└─────────┘',
      ].join('\n'),
    )
  })

  it('rounds the corners of round blocks, and uses plus signs in ASCII mode', () => {
    expect(render('block-beta\n  a("x")')).toBe(
      ['╭───╮', '│ x │', '╰───╯'].join('\n'),
    )
    expect(render('block-beta\n  a("x")', true)).toBe(
      ['+---+', '| x |', '+---+'].join('\n'),
    )
  })

  it('frames a group around its cells and stretches its neighbours to match', () => {
    expect(render('block-beta\n  block:g\n    columns 1\n    a\n    b\n  end\n  c')).toBe(
      [
        '┌───────┐ ┌───────┐',
        '│ ┌───┐ │ │       │',
        '│ │ a │ │ │       │',
        '│ └───┘ │ │   c   │',
        '│ ┌───┐ │ │       │',
        '│ │ b │ │ │       │',
        '│ └───┘ │ │       │',
        '└───────┘ └───────┘',
      ].join('\n'),
    )
  })

  it('lines up wide characters and multi-line labels', () => {
    const out = render('block-beta\n  a["日本<br/>x"]')
    expect(out.split('\n')[1]).toBe('│ 日本 │')
    expect(out.split('\n')).toHaveLength(4)
  })

  it('is empty for an empty diagram', () => {
    expect(render('block-beta')).toBe('')
  })

  it('paints frames and labels in colour modes', () => {
    const out = renderMermaidASCII('block-beta\n  a', {
      colorMode: 'truecolor',
    })
    expect(out).toContain('\u001b[')
  })
})
