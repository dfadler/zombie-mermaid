/**
 * #1413: in a TD graph where two labelled edges share a lane, both picked the
 * same segment and the later label overwrote the earlier, so `fifth` vanished.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SRC = `flowchart TD
  A --> B
  A -->|first| C
  B -->|second| C
  A -->|third| D
  C -->|fourth| D
  B -->|fifth| D`

describe('labelled fan-in sharing a lane (#1413)', () => {
  for (const useAscii of [false, true]) {
    it(`draws every label (${useAscii ? 'ascii' : 'unicode'})`, () => {
      const out = renderMermaidASCII(SRC, { colorMode: 'none', useAscii })
      for (const label of ['first', 'second', 'third', 'fourth', 'fifth']) {
        expect(out).toContain(label)
      }
    })
  }

  // B's second port stem (B-->D) must reach the shared lane: `second` sits on
  // B-->C's stroke and used to reach across and overwrite that stem, leaving
  // B-->D with no path out of B.
  for (const useAscii of [false, true]) {
    it(`keeps B-->D's stem clear of the "second" label (${useAscii ? 'ascii' : 'unicode'})`, () => {
      const rows = renderMermaidASCII(SRC, {
        colorMode: 'none',
        useAscii,
      }).split('\n')
      const second = rows.findIndex((r) => r.includes('second'))
      const stem = useAscii ? '|' : '│'
      expect(rows[second]).toMatch(new RegExp(`second\\s*\\${stem}`))
      // ...and it turns toward its own lane on the next row.
      expect(rows[second + 1]).toMatch(useAscii ? /\+-+/ : /└─+/)
    })
  }
})
