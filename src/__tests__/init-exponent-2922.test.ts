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

describe('packet init config', () => {
  const packet = (body: string) =>
    parseInitDirective(`%%{init: {"packet": ${body}}}%%`)?.packet

  it('keeps valid keys and drops bad values', () => {
    expect(
      packet(
        '{"bitsPerRow": 16, "bitWidth": 10, "rowHeight": 0, "paddingX": 2, "paddingY": 3, "showBits": false, "bitOrder": "descending"}',
      ),
    ).toEqual({
      bitsPerRow: 16,
      bitWidth: 10,
      rowHeight: 0,
      paddingX: 2,
      paddingY: 3,
      showBits: false,
      bitOrder: 'descending',
    })
    expect(
      packet(
        '{"bitsPerRow": 0, "bitWidth": -1, "rowHeight": 1e9, "showBits": "no", "bitOrder": "sideways", "paddingX": "5"}',
      ),
      // Bad sizes are dropped; the string and the flag are read as mermaid 12.3.0
      // does (numeric string, truthy `showBits`, non-`descending` is ascending).
    ).toEqual({ paddingX: 5, showBits: true, bitOrder: 'ascending' })
    expect(packet('{"bitsPerRow": 2.5}')).toEqual({})
  })
})
