/**
 * #1436: edges into one node from different sources used to share one trunk
 * and one arrowhead. Each now lands in its own column with its own arrowhead.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SRC = `flowchart TD
  A --> B
  A --> |first| C
  B --> |second| C
  A --> |third| D
  C --> |fourth| D
  B --> |fifth| D`

describe('TD fan-in landings (#1436)', () => {
  for (const [useAscii, head] of [
    [false, '▼'],
    [true, 'v'],
  ] as const) {
    it(`gives A-->D, B-->D and C-->D an arrowhead each (${useAscii ? 'ascii' : 'unicode'})`, () => {
      const rows = renderMermaidASCII(SRC, {
        colorMode: 'none',
        useAscii,
      }).split('\n')
      const dBox = rows.findIndex((r) => r.includes('D'))
      expect(rows[dBox - 3]!.split(head).length - 1).toBe(3)
    })
  }
})
