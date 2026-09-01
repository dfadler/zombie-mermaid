// ============================================================================
// ASCII sequence diagram — alt/else block label truncation regression tests
// (issue #352)
//
// The alt/loop/opt/par block's wall (bLeft/bRight) was sized purely from the
// span of the lifelines its messages touch (plus self-arrow extent, fixed
// for #68). Header ("alt [label]") and divider ("[else label]") text is
// drawn starting at bLeft + 1 and hard-clipped at bRight — so a label longer
// than that message-driven span lost its tail with no ellipsis or other
// marker, and because the cut lands mid-word the truncated text can still
// read as a complete (but wrong) phrase, e.g. "alt [credentials" instead of
// "alt [credentials valid]".
//
// The fix measures the longest label among the block's header and every
// divider up front and widens the wall (growing the canvas too, if needed)
// to fit it, mirroring the self-arrow widening done for #68.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('ASCII sequence diagrams – alt/else block labels (issue #352)', () => {
  it('does not truncate a long alt/else label mid-word (exact issue repro)', () => {
    const result = renderMermaidASCII(
      `
sequenceDiagram
    participant A
    participant B
    participant C
    alt credentials valid
        A->>B: x
    else credentials rejected
        A->>B: y
    end
`,
      { useAscii: false },
    )

    // Full, unclipped labels must appear.
    expect(result).toContain('alt [credentials valid]')
    expect(result).toContain('[credentials rejected]')

    // The exact mid-word-truncated strings from the issue must be gone —
    // checked with a trailing wall/junction character so a match against
    // the (correct) full label's shared prefix doesn't false-positive.
    expect(result).not.toContain('┌alt [credentials┐')
    expect(result).not.toContain('[credentials rej┤')
  })

  it('leaves short labels that already fit unchanged (no regression)', () => {
    const result = renderMermaidASCII(
      `
sequenceDiagram
    participant A
    participant B
    participant C
    alt yes
        A->>B: x
    else no
        A->>B: y
    end
`,
      { useAscii: false },
    )

    // Matches the issue's own "short labels, for reference" expected output.
    expect(result).toContain('alt [yes]───────┐')
    expect(result).toContain('[no]╌╌╌╌╌╌╌╌╌╌╌╌┤')
  })

  it('widens the wall for a very long single-condition label', () => {
    const longLabel =
      'this condition label is extremely long and needs the canvas to grow to fit it properly'
    const result = renderMermaidASCII(
      `
sequenceDiagram
    participant A
    participant B
    alt ${longLabel}
        A->>B: x
    end
`,
      { useAscii: false },
    )

    expect(result).toContain(`alt [${longLabel}]`)

    // The header line's own right wall must close immediately after the
    // label — proves the wall grew to fit rather than the label being cut.
    const headerLine = result
      .split('\n')
      .find((l) => l.includes(`alt [${longLabel}]`))
    expect(headerLine).toBeDefined()
    expect(headerLine!.endsWith('┐')).toBe(true)
  })

  it('widens the wall to fit the longest of several else branches with varying label lengths', () => {
    const result = renderMermaidASCII(
      `
sequenceDiagram
    participant A
    participant B
    alt short
        A->>B: w
    else a moderately long condition
        A->>B: x
    else an even longer condition than the previous one
        A->>B: y
    else tiny
        A->>B: z
    end
`,
      { useAscii: false },
    )

    expect(result).toContain('alt [short]')
    expect(result).toContain('[a moderately long condition]')
    expect(result).toContain('[an even longer condition than the previous one]')
    expect(result).toContain('[tiny]')

    // None of the labels should be cut short — checked with the closing
    // bracket so a match against the (correct) full label's shared prefix
    // doesn't false-positive.
    expect(result).not.toContain('[a moderately long conditio]')
    expect(result).not.toContain(
      '[an even longer condition than the previous]',
    )
  })

  it('widens loop/opt block walls too, not just alt', () => {
    const loopResult = renderMermaidASCII(
      `
sequenceDiagram
    participant A
    participant B
    loop a fairly long loop condition label here
        A->>B: x
    end
`,
      { useAscii: false },
    )
    expect(loopResult).toContain(
      'loop [a fairly long loop condition label here]',
    )

    const optResult = renderMermaidASCII(
      `
sequenceDiagram
    participant A
    participant B
    opt a fairly long optional condition label here
        A->>B: x
    end
`,
      { useAscii: false },
    )
    expect(optResult).toContain(
      'opt [a fairly long optional condition label here]',
    )
  })
})
