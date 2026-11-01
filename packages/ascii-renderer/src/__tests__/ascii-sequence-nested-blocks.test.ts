import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '../index.ts'

// Nested blocks nest (#2497): the inner block is drawn inside the outer one,
// below its header, with its walls strictly inside the outer walls.
const SRC = `sequenceDiagram
  participant A
  participant B
  alt cache hit
    loop every retry
      A->>B: fetch
    end
  else cache miss
    opt warm up
      B->>B: rebuild
    end
  end`

describe('ASCII sequence nested blocks (#2497)', () => {
  const lines = renderMermaidASCII(SRC, { useAscii: false }).split('\n')
  const row = (s: string) => lines.findIndex((l) => l.includes(s))

  it('draws nested headers below the enclosing header', () => {
    expect(row('alt [cache hit]')).toBeLessThan(row('loop [every retry]'))
    expect(row('[cache miss]')).toBeLessThan(row('opt [warm up]'))
  })

  it('keeps the inner walls inside the outer walls', () => {
    const outer = lines[row('alt [cache hit]')]!
    const inner = lines[row('loop [every retry]')]!
    expect(inner.indexOf('┌')).toBeGreaterThan(outer.indexOf('┌'))
    expect(inner.lastIndexOf('┐')).toBeLessThan(outer.lastIndexOf('┐'))
  })

  it('closes the inner block inside the outer one', () => {
    expect(lines.some((l) => l.startsWith('│└'))).toBe(true)
    expect(lines.some((l) => l.startsWith('└'))).toBe(true)
  })
})

describe('ASCII sequence nested blocks over the same lifelines (#2497)', () => {
  const lines = renderMermaidASCII(
    `sequenceDiagram
  A->>B: go
  alt outer
    loop inner
      A->>B: fetch
    end
  end`,
    { useAscii: false },
  ).split('\n')
  const row = (s: string) => lines.findIndex((l) => l.includes(s))

  it('insets the inner block one column on each side', () => {
    const outer = lines[row('alt [outer]')]!
    const inner = lines[row('loop [inner]')]!
    expect(inner.indexOf('┌')).toBe(outer.indexOf('┌') + 1)
    expect(inner.lastIndexOf('┐')).toBe(outer.lastIndexOf('┐') - 1)
  })
})
