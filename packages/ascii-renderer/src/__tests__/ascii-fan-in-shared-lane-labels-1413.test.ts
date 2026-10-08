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
})
