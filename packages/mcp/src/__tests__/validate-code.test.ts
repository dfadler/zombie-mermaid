// #2346: validate_mermaid diagnostics carry a stable `code`.
import { describe, it, expect } from 'vitest'
import { validateHandler } from '../tools/validate.ts'

function run(diagram: string) {
  const res = validateHandler({ diagram })
  return JSON.parse((res.content[0] as { text: string }).text)
}

describe('validate_mermaid diagnostic code', () => {
  it('EMPTY_DIAGRAM for blank input', () => {
    expect(run('  \n').diagnostics[0].code).toBe('EMPTY_DIAGRAM')
  })
  it('PARSE_ERROR for a syntax error, keeping line info', () => {
    const d = run('graph XX\n  A --> B').diagnostics[0]
    expect(d).toMatchObject({ code: 'PARSE_ERROR', line: 1 })
  })
  it('valid diagrams have no diagnostics', () => {
    expect(run('graph LR\n  A --> B')).toEqual({ valid: true, diagnostics: [] })
  })
})
