/**
 * #2555: a trailing empty else/and/option section lost its divider. Mermaid
 * 12.3.0 still draws it (a dashed loopLine).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const ALT = `sequenceDiagram
  alt a
    A->>B: x
  else b
  end`
const PAR = `sequenceDiagram
  par a
    A->>B: x
  and
  end
  B->>A: after`
const OPT = `sequenceDiagram
  critical a
    A->>B: x
  option
  option c
  end`

describe('sequence trailing empty section divider (#2555)', () => {
  it.each([
    ['alt/else', ALT, 3],
    ['par/and with a message after', PAR, 3],
    ['critical/option x2', OPT, 4],
  ])('ASCII draws the divider: %s', (_n, src, borders) => {
    const out = renderMermaidASCII(src, { useAscii: true })
    // Top border + one divider per else/and/option + bottom border
    expect(out.split('\n').filter((l) => l.startsWith('+-')).length).toBe(
      borders,
    )
  })
})
