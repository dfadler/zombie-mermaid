import { describe, it, expect } from 'vitest'
import { extractAccessibility } from '../accessibility.ts'

describe('extractAccessibility', () => {
  it('reads single-line and block forms, last one winning', () => {
    const r = extractAccessibility(
      'graph TD\n  accTitle: One\n  accTitle: Two\n  accDescr {\n   a\n\n   b\n  }\n  A-->B',
    )
    expect(r.accTitle).toBe('Two')
    expect(r.accDescr).toBe('a\nb')
  })

  it('keeps line numbers by blanking statements', () => {
    const r = extractAccessibility('graph TD\n accDescr {\n x\n }\nA-->B')
    expect(r.text.split('\n')).toEqual(['graph TD', '', '', '', 'A-->B'])
  })

  it('cuts a trailing %% comment off single-line values', () => {
    expect(extractAccessibility('graph TD\naccTitle: T %% c').accTitle).toBe('T')
  })

  it('leaves pie and text without statements untouched', () => {
    const pie = 'pie\n  accTitle: T\n  "a" : 1'
    expect(extractAccessibility(pie)).toEqual({ text: pie })
    expect(extractAccessibility('graph TD\nacc --> B')).toEqual({
      text: 'graph TD\nacc --> B',
    })
  })
})
