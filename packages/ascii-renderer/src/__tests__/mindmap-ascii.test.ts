/**
 * Mindmap ASCII/Unicode rendering: tree connectors, shape delimiters,
 * multi-line labels, and colour. Whole-output goldens for both charsets live
 * in testdata/{ascii,unicode}/mindmap_*.txt (run by ascii.test.ts).
 */
import { describe, it, expect } from 'vitest'
import { readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (text: string, useAscii = false) =>
  renderMermaidASCII(text, { colorMode: 'none', useAscii })

describe('mindmap ASCII: tree', () => {
  const src = 'mindmap\n  root\n    A\n      A1\n    B'

  it('draws the root first and children with tee/end connectors', () => {
    expect(render(src)).toBe('root\n├── A\n│   └── A1\n└── B')
  })

  it('uses + ` | in ASCII mode', () => {
    const out = render(src, true)
    expect(out).toBe('root\n+-- A\n|   `-- A1\n`-- B')
    expect(out).not.toMatch(/[├└│─]/)
  })

  it('keeps the rail beside a multi-line label and aligns its continuation', () => {
    const out = render('mindmap\n  r\n    one<br>two\n    three')
    expect(out).toBe('r\n├── one\n│   two\n└── three')
  })

  it('wraps a multi-line root with no indent', () => {
    expect(render('mindmap\n  root[a<br>b]\n    c')).toBe('[a\nb]\n└── c')
  })

  it('has no trailing whitespace', () => {
    expect(
      render(src)
        .split('\n')
        .every((l) => l === l.trimEnd()),
    ).toBe(true)
  })
})

describe('mindmap ASCII: shapes', () => {
  it.each([
    ['plain', 'plain'],
    ['[x]', '[x]'],
    ['(x)', '(x)'],
    ['((x))', '((x))'],
    [')x(', ')x('],
    ['))x((', '))x(('],
    ['{{x}}', '{{x}}'],
  ])('draws %s with its delimiters', (node, drawn) => {
    expect(render(`mindmap\n  r\n    ${node}`)).toBe(`r\n└── ${drawn}`)
  })
})

describe('mindmap ASCII: colour', () => {
  const src = 'mindmap\n  root\n    A'
  const theme = {
    bg: '#fff',
    fg: '#000000',
    accent: '#ff0000',
    line: '#00ff00',
  }

  it('paints the root in the accent, connectors in the line colour', () => {
    const out = renderMermaidASCII(src, { colorMode: 'truecolor', theme })
    expect(out).toContain('\x1b[38;2;255;0;0mroot')
    expect(out).toContain('\x1b[38;2;0;255;0m└── ')
    expect(out).toContain('\x1b[38;2;0;0;0mA')
  })

  it('produces no escapes without a colour mode', () => {
    expect(render(src)).not.toContain('\x1b')
  })

  it('wraps text in spans for the html colour mode', () => {
    expect(renderMermaidASCII(src, { colorMode: 'html' })).toContain('<span')
  })

  it('escapes markup in the html colour mode', () => {
    expect(
      renderMermaidASCII('mindmap\n  root\n    A & B', { colorMode: 'html' }),
    ).toContain('&amp;')
  })

  it('leaves no trailing connector padding before an empty label line', () => {
    const out = renderMermaidASCII('mindmap\n  root\n    a<br/><br/>b', {
      colorMode: 'truecolor',
      theme,
    })
    // The connector rail of the blank line ends the line; no padding follows its colour.
    for (const line of out.split('\n')) expect(line).toBe(line.trimEnd())
  })
})

describe('mindmap ASCII: goldens', () => {
  it('has an ascii and a unicode golden for every case', () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), 'testdata')
    const names = (d: string) =>
      readdirSync(join(dir, d)).filter((f) => f.startsWith('mindmap_'))
    expect(names('ascii').length).toBeGreaterThanOrEqual(9)
    expect(names('ascii')).toEqual(names('unicode'))
  })
})
