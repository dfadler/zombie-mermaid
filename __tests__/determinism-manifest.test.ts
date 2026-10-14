import { describe, expect, it } from 'vitest'
import {
  attempt,
  hash,
  manifestLines,
} from '../scripts/lib/determinism-manifest.ts'

describe('manifestLines', () => {
  const samples = [
    { title: 'A  b', source: 'one' },
    { title: 'C', source: 'boom' },
  ]
  const svg = (s: string) => {
    if (s === 'boom') throw new Error('bad')
    return `svg:${s}`
  }
  const ascii = (s: string) => `asc:${s}`

  it('emits svg then ascii per sample, collapsing title whitespace', () => {
    const lines = manifestLines(samples, svg, ascii)
    expect(lines).toEqual([
      `${hash('svg:one')} svg 0 A b`,
      `${hash('asc:one')} ascii 0 A b`,
      `${hash('THROW:bad')} svg 1 C`,
      `${hash('asc:boom')} ascii 1 C`,
    ])
  })

  it('changes the line when output changes', () => {
    const a = manifestLines(samples, svg, ascii)
    const b = manifestLines(samples, svg, (s) => `${ascii(s)}!`)
    expect(a[0]).toBe(b[0])
    expect(a[1]).not.toBe(b[1])
  })

  it('hashes a non-Error throw via String()', () => {
    expect(
      attempt(() => {
        throw 'oops'
      }),
    ).toBe('THROW:oops')
  })
})
