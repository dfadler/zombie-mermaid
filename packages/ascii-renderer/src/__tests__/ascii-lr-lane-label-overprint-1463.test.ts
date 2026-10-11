/**
 * #1463: sliding a shared-stem label (#1433) onto a row where a later edge's
 * label sits on the lane overprinted it (`sixtfifth`).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { slideClearOf } from '../draw-arrows.ts'

const SRC = `flowchart LR
  A --> B
  A -->|first| C
  B -->|second| C
  A -->|third| D
  C -->|fourth| D
  B -->|fifth| D
  B -->|sixth| D
  A -->|seventh| D`
const LABELS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
]

describe('LR labels stay readable when a stem label slides (#1463)', () => {
  for (const useAscii of [false, true]) {
    it(`prints every label whole (${useAscii ? 'ascii' : 'unicode'})`, () => {
      const out = renderMermaidASCII(SRC, { colorMode: 'none', useAscii })
      for (const label of LABELS) expect(out).toContain(label)
      // Both present but run together would still pass the loop above.
      expect(out).not.toContain('sixthfifth')
      expect(out).not.toContain('fifthsixth')
    })
  }
})

describe('label placement memo (#1466)', () => {
  it('never carries a placement from one render into the next', () => {
    const opts = { colorMode: 'none' as const }
    renderMermaidASCII(
      'flowchart LR\n  X -->|alpha| Z\n  Y -->|beta| Z\n  X --> Y',
      opts,
    )
    const out = renderMermaidASCII(
      'flowchart LR\n  A -->|gamma| C\n  B -->|delta| C\n  A --> B',
      opts,
    )
    expect(out).toContain('gamma')
    expect(out).toContain('delta')
    expect(out).not.toContain('alpha')
  })
})

describe('slideClearOf avoid list (#1463)', () => {
  const at = (y: number, text = 'fifth') => [{ x: 30, y, text }]

  it('skips a row an avoided label covers, without treating it as a clash', () => {
    expect(slideClearOf(at(4), at(3), 2, 6, [])).toEqual(at(4))
    expect(slideClearOf(at(4), at(4), 2, 6, at(5))).toEqual(at(3))
  })
})
