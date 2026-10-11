/**
 * #1439: in a TD fan-in, edges into one node from different sources shared one
 * column over their whole length, so `third` and `fifth` could not be told
 * apart. Each source now gets a column of its own.
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

describe('TD fan-in lanes (#1439)', () => {
  for (const useAscii of [false, true]) {
    it(`draws B-->D in a column apart from A-->D (${useAscii ? 'ascii' : 'unicode'})`, () => {
      const rows = renderMermaidASCII(SRC, {
        colorMode: 'none',
        useAscii,
      }).split('\n')
      const stem = useAscii ? '|' : '│'
      const fifth = rows.find((r) => r.includes('fifth'))!
      // C's stem, A-->D's lane and B-->D's own lane: three strokes on this
      // row, where a shared lane showed only two.
      expect(fifth.split(stem).length - 1).toBe(3)
    })
  }
})
