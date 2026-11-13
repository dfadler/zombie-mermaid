// #2790: mermaid 12.3.0 draws C4 relationships centre to centre, so a line can
// cross shapes. A character cell cannot, so ASCII routes bend; when a detour
// exists they must not also cross each other, where a `┼` reads as a junction.
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '../../../../src/index.ts'

const SRC = `C4Context
  Person(a, "A")
  System(b, "B")
  System(c, "C")
  System(d, "D")
  System(e, "E")
  System(f, "F")
  Rel(a, b, "ab")
  Rel(a, e, "ae")
  Rel(b, f, "bf")
  Rel(a, d, "ad")`

describe('C4 ASCII route crossings (#2790)', () => {
  it('routes a long relationship around another route instead of crossing it', () => {
    const out = renderMermaidASCII(SRC)
    expect(out).toContain('ad')
    expect(out).not.toContain('┼')
  })
})
