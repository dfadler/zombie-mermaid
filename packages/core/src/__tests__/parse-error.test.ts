import { describe, it, expect } from 'vitest'
import { MermaidParseError } from '../parse-error.ts'

describe('MermaidParseError (#1855)', () => {
  it('keeps message byte-identical and lifts the Line prefix into .line', () => {
    const e = new MermaidParseError('Line 3: bad thing')
    expect(e).toBeInstanceOf(Error)
    expect(e.message).toBe('Line 3: bad thing')
    expect(e.line).toBe(3)
    expect(e.column).toBeUndefined()
  })

  it('leaves line undefined without a prefix; explicit options win', () => {
    expect(new MermaidParseError('no position').line).toBeUndefined()
    const e = new MermaidParseError('Line 3: x', {
      line: 9,
      column: 2,
      code: 'LIMIT_EXCEEDED',
      diagramType: 'pie',
    })
    expect([e.line, e.column, e.code, e.diagramType]).toEqual([
      9,
      2,
      'LIMIT_EXCEEDED',
      'pie',
    ])
  })
})
