/**
 * Ishikawa ASCII/Unicode rendering: the spine and head, bones above and below,
 * causes and their leaders, label handling and charsets. Whole-output goldens
 * live in testdata/*\/ishikawa_*.txt.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (text: string, useAscii = false) =>
  renderMermaidASCII(text, { colorMode: 'none', useAscii })

describe('ishikawa ASCII', () => {
  it('draws a lone effect as a box', () => {
    expect(render('ishikawa\n  Only')).toBe(
      ['┌──────┐', '│ Only │', '└──────┘'].join('\n'),
    )
  })

  it('draws nothing for a header with no lines', () => {
    expect(render('ishikawa\n')).toBe('')
  })

  it('hangs the first category above the spine and the second below, joined to the head', () => {
    const out = render('ishikawa\n  E\n    Up\n      u\n    Down\n      d')
    expect(out).toBe(
      [
        '[ Up ]',
        'u ──╲\n'.trimEnd(),
        '     ╲     ┌───┐',
        '──────┴┬──►│ E │',
        'd ────╱    └───┘',
        '     ╱',
        '[ Down ]',
      ].join('\n'),
    )
  })

  it('puts later pairs further from the head and lists causes in source order', () => {
    const lines = render(
      'ishikawa\n  E\n    A\n      a1\n      a2\n    B\n    C\n      c1',
    ).split('\n')
    const spine = lines.find((l) => l.includes('►'))!
    expect(spine.match(/┴|┬/g)).toHaveLength(3)
    const text = lines.join('\n')
    expect(text.indexOf('a1')).toBeLessThan(text.indexOf('a2'))
    expect(text.indexOf('[ C ]')).toBeLessThan(text.indexOf('[ A ]'))
  })

  it('marks a cause one level down with └ and indents it further each level', () => {
    const out = render('ishikawa\n  E\n    A\n      a\n        b\n          c')
    expect(out).toContain('└ b')
    expect(out).toMatch(/ {2}└ c/)
  })

  it('joins a multi-line effect and treats <br> in a label as a space', () => {
    const out = render(
      'ishikawa\n  One<br>Two\n    Cat<br/>egory\n      a<br>b',
    )
    expect(out).toContain('│ One')
    expect(out).toContain('│ Two')
    expect(out).toContain('[ Cat egory ]')
    expect(out).toContain('a b')
  })

  it('uses plain characters in ASCII mode', () => {
    const out = render(
      'ishikawa\n  E\n    Up\n      u\n    Down\n      d\n      x\n        y',
      true,
    )
    expect(out).toMatch(/\\/)
    expect(out).toMatch(/\//)
    expect(out).toContain('`')
    expect(out).toContain('->| E |')
    expect(out).not.toMatch(/[^\x00-\x7f]/)
  })

  it('keeps wide (CJK) labels aligned with the bone', () => {
    const out = render('ishikawa\n  結果\n    原因\n      細かい原因')
    expect(out).toContain('[ 原因 ]')
    expect(out).toContain('細かい原因 ─')
  })

  it('draws a category with no causes as a short bone', () => {
    const out = render('ishikawa\n  E\n    Bare')
    expect(out.split('\n')).toHaveLength(5)
    expect(out).toContain('[ Bare ]')
  })
})
