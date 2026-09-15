/**
 * Regression tests for #1083: the last edge in a mixed-style fan-out got a
 * bogus diagonal arrowhead (↘) instead of a straight one (▼), even though
 * its line was perfectly vertical with zero horizontal drift.
 *
 * Root cause: that edge's route fell through to determinePath's Case-4
 * direct fallback (see #418), producing a single non-axis-aligned grid
 * segment. draw-lines.ts's drawLine draws that as an L (horizontal run,
 * then vertical run) folded into one `linesDrawn` entry. drawArrowHead used
 * to derive direction from that entry's *first* and *last* point, which
 * spans both legs of the L and reads as diagonal — even when the actual
 * final approach into the arrowhead is a plain vertical step. Fixed by
 * deriving direction from the last two points (the final step) instead.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const ARROWHEAD_CHARS = '▼▲◄►↖↗↘↙'

function arrowCharsInLastRowBeforeTargets(source: string): string[] {
  const lines = renderMermaidASCII(source, { colorMode: 'none' }).split('\n')
  const arrowRow = lines.find((l) =>
    [...l].some((ch) => ARROWHEAD_CHARS.includes(ch)),
  )!
  return [...arrowRow].filter((ch) => ARROWHEAD_CHARS.includes(ch))
}

describe('arrowhead direction on a Case-4 direct-fallback (diagonal) path', () => {
  it('renders every arrowhead as ▼ when thick is the last mixed-style edge', () => {
    const source = `graph TD
  A[Source] -->|solid| B[Target 1]
  A -.->|dotted| C[Target 2]
  A ==>|thick| D[Target 3]`

    const arrows = arrowCharsInLastRowBeforeTargets(source)
    expect(arrows).toEqual(['▼', '▼', '▼'])
  })

  it('renders every arrowhead as ▼ regardless of which style is last', () => {
    // Same three styles, reordered so `solid` (not `thick`) is the one that
    // falls through to the Case-4 fallback — the bug followed *position*,
    // not the specific style.
    const source = `graph TD
  A[Source] ==>|thick| B[Target 1]
  A -.->|dotted| C[Target 2]
  A -->|solid| D[Target 3]`

    const arrows = arrowCharsInLastRowBeforeTargets(source)
    expect(arrows).toEqual(['▼', '▼', '▼'])
  })
})
