/**
 * #2639: an up fan (`D --> B` x4 with `B --> C --> D` between) put its label
 * `three` on the blank row of C, which sat on the fan's axis. As in Mermaid
 * 12.3.0, C now steps aside (to the side its first edge was declared on), D
 * stays under B, and the four labels share one row beside C.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const FAN = `  D --> B : one
  D --> B : two
  D --> B : three
  D --> B : four`
const CASES = {
  left: `classDiagram\n  A --> B\n  B --> C\n  C --> D\n${FAN}`,
  right: `classDiagram\n  A --> B\n${FAN}\n  B --> C\n  C --> D`,
}

/** Column span of the box whose name row reads `│ X │` (or `| X |`). */
function boxSpan(lines: string[], name: string, v: string) {
  const row = lines.findIndex((l) => l.includes(`${v} ${name} ${v}`))
  const c0 = lines[row]!.indexOf(`${v} ${name} ${v}`)
  return { row, c0, c1: c0 + 4 }
}

describe('ASCII class diagram: up fan past an intermediate class (#2639)', () => {
  for (const [side, src] of Object.entries(CASES)) {
    for (const useAscii of [false, true]) {
      it(`C steps aside to the ${side}, labels share a row (useAscii=${useAscii})`, () => {
        const lines = renderMermaidASCII(src, {
          useAscii,
          colorMode: 'none',
        }).split('\n')
        const v = useAscii ? '|' : '│'
        const b = boxSpan(lines, 'B', v)
        const c = boxSpan(lines, 'C', v)
        const d = boxSpan(lines, 'D', v)
        expect(d.c0).toBe(b.c0) // D stays under B

        const labelRows = ['one', 'two', 'three', 'four'].map((l) =>
          lines.findIndex((x) => x.includes(l)),
        )
        expect(new Set(labelRows).size).toBe(1)
        const row = labelRows[0]!
        expect(row).toBeGreaterThan(b.row)
        expect(row).toBeLessThan(d.row)
        // Level with C (its rows span the label row)
        expect(row).toBeGreaterThan(c.row)
        expect(row).toBeLessThan(c.row + 6)

        // No lane (the label's own column) runs through C's columns
        const text = lines[row]!
        for (const l of ['one', 'two', 'three', 'four']) {
          const mid = text.indexOf(l) + Math.floor(l.length / 2)
          expect(mid < c.c0 || mid > c.c1).toBe(true)
        }
        // C sits wholly on one side of the fan, and keeps its borders
        const fan = ['one', 'four'].map((l) => text.indexOf(l))
        if (side === 'left') expect(c.c1).toBeLessThan(Math.min(...fan))
        else expect(c.c0).toBeGreaterThan(Math.max(...fan) + 4)
        for (let y = c.row - 1; y < c.row + 6; y++) {
          expect(lines[y]![c.c0]).not.toBe(' ')
          expect(lines[y]![c.c1]).not.toBe(' ')
        }
        // The four arrowheads stay under B
        expect(lines.some((l) => l.split('^').length - 1 === 4)).toBe(true)
      })
    }
  }
})
