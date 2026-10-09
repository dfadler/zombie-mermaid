/**
 * #1436: edges into one node from different sources each keep their own
 * stem and arrowhead. These cover the arrangements `separateFanIns` has to
 * order or decline: edges arriving from the left, a straight edge among them,
 * and a port that also starts an edge.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (src: string, useAscii: boolean): string[] =>
  renderMermaidASCII(src, { colorMode: 'none', useAscii }).split('\n')

/** Arrowheads on the row above the first box that holds `name`. */
function headsAbove(rows: string[], name: string, head: string): number {
  const top = rows.findIndex((r) =>
    new RegExp(`[│|]\\s+${name}\\s+[│|]`).test(r),
  )
  return rows[top - 3]!.split(head).length - 1
}

const FROM_LEFT = `flowchart TD
  X --> Y
  A --> B
  A --> |first| C
  B --> |second| C
  A --> |third| D
  C --> |fourth| D
  B --> |fifth| D
  X --> |sixth| D
  Y --> |seventh| D`

const BACK_EDGE = `flowchart TD
  A --> B
  A --> |first| C
  B --> |second| C
  A --> |third| D
  C --> |fourth| D
  B --> |fifth| D
  D --> |back| C`

describe('TD fan-in landings (#1436)', () => {
  for (const [useAscii, head] of [
    [false, '▼'],
    [true, 'v'],
  ] as const) {
    const mode = useAscii ? 'ascii' : 'unicode'

    it(`lands edges from the left beside a straight one (${mode})`, () => {
      // sixth (bent, from the left) and seventh (straight) get a head each.
      expect(headsAbove(render(FROM_LEFT, useAscii), 'D', head)).toBe(2)
    })

    it(`keeps one trunk where the port also starts an edge (${mode})`, () => {
      const rows = render(BACK_EDGE, useAscii)
      // D sends an edge back out of its top face, so its arrivals stay
      // merged, while C still gets one arrowhead per edge.
      expect(headsAbove(rows, 'D', head)).toBe(1)
      expect(headsAbove(rows, 'C', head)).toBe(2)
    })
  }
})
