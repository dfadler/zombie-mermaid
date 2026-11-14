/**
 * Use case ASCII/Unicode rendering: an actor is a box holding a stick figure
 * over its name, a use case a rounded box, a boundary a titled frame.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (text: string, useAscii = false) =>
  renderMermaidASCII(text, { colorMode: 'none', useAscii })

describe('use case ASCII', () => {
  it('draws an actor as a stick figure over its name', () => {
    const out = render('usecase-beta\nactor Customer\nCustomer --> Browse')
    expect(out).toMatch(/O\s*│/)
    expect(out).toContain('/|\\')
    expect(out).toContain('/ \\')
    expect(out).toContain('Customer')
    expect(out).toContain('╭') // the use case is a rounded box
  })

  it('draws a boundary, the include label and a note', () => {
    const out = render(
      'usecase-beta\nsystemBoundary Shop\n  A\n  B\nend\nA ..> : include B\nnote for A "careful"',
    )
    expect(out).toContain('Shop')
    expect(out).toContain('«include»')
    expect(out).toContain('careful')
    expect(out).toContain('┄') // dotted
  })

  it('ends a generalization in a hollow head', () => {
    expect(render('usecase-beta\nactor A\nactor B\nA --|> B')).toContain('▷')
    expect(
      render('usecase-beta\nactor A\nactor B\nA --|> B', true),
    ).not.toMatch(/[^\x00-\x7f]/)
  })

  it('uses plain characters in ASCII mode', () => {
    const out = render('usecase-beta\nA --> B\nnote for A "n"', true)
    expect(out).not.toMatch(/[^\x00-\x7f]/)
    expect(out).toContain('.')
  })

  it('draws rectangular use cases as boxes', () => {
    expect(render('usecase-beta\nA[Box]')).toContain('┌')
  })
})
