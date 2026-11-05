/**
 * #2639: an upward fanned group (`D --> B` x4 with `B --> C --> D` between,
 * rooted by `A --> B`) placed the label `three` on C's blank compartment row
 * and dropped C's side borders there. The label must move to a clear row,
 * leave C's rows intact, and keep the arrowhead row under B.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SRC = `classDiagram
  A --> B
  B --> C
  C --> D
  D --> B : one
  D --> B : two
  D --> B : three
  D --> B : four`

describe('ASCII class diagram: upward fan label over an intermediate class (#2639)', () => {
  for (const useAscii of [false, true]) {
    it(`keeps C's compartment rows intact (useAscii=${useAscii})`, () => {
      const lines = renderMermaidASCII(SRC, {
        useAscii,
        colorMode: 'none',
      }).split('\n')
      const v = useAscii ? '|' : '│'
      const top = lines.findIndex((l) => l.includes(`${v} C ${v}`))
      expect(top).toBeGreaterThan(0)
      const c0 = lines[top]!.indexOf(`${v} C ${v}`)
      // Name row, divider, blank, divider, blank: every row keeps both borders
      for (let y = top; y < top + 5; y++) {
        expect(lines[y]!.slice(c0, c0 + 5)).toMatch(
          useAscii ? /^[|+]...[|+]$/ : /^[│├]...[│┤]$/,
        )
      }
      for (const l of ['one', 'two', 'three', 'four']) {
        expect(lines.filter((x) => x.includes(l))).toHaveLength(1)
      }
      // The fan's labels share one row, as in Mermaid
      expect(
        new Set(
          ['one', 'two', 'three', 'four'].map((l) =>
            lines.findIndex((x) => x.includes(l)),
          ),
        ).size,
      ).toBe(1)
      // The four arrowheads stay on the row under B
      const heads = lines.find((l) => l.split('^').length - 1 === 4)
      expect(heads).toBeDefined()
    })
  }
})
