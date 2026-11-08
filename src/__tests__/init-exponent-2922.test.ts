import { describe, it, expect } from 'vitest'
import { parseInitDirective } from '@zombie-mermaid/core'

const tl = (n: string) =>
  parseInitDirective(
    `%%{init: {"timeline": {"leftMargin": ${n}, "padding": 10}}}%%`,
  )?.timeline

describe('init directive exponent numbers (#2922)', () => {
  it.each([
    ['1e2', 100],
    ['1E2', 100],
    ['1e+2', 100],
    ['1500e-1', 150],
    ['1.5e2', 150],
    ['2.5E1', 25],
  ])('%s keeps the whole directive', (src, want) => {
    expect(tl(src)).toEqual({ leftMargin: want, padding: 10 })
  })

  it('still validates after parsing', () => {
    expect(tl('-1e2')).not.toHaveProperty('leftMargin', -100)
  })

  it('leaves bare words and strings alone', () => {
    expect(
      parseInitDirective(
        "%%{init: {theme: 'dark', timeline: {padding: 1e1}}}%%",
      )?.timeline,
    ).toEqual({ padding: 10 })
  })

  it('ignores a lone minus sign without throwing', () => {
    expect(parseInitDirective('%%{init: {"theme": -}}%%')).toBeUndefined()
  })
})
