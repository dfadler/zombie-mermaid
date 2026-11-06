/**
 * #2731: a TD edge that skips a node (`Q --> W` past `R`) was folded into the
 * stem of the node it skips, so one arrowhead served both edges. Mermaid
 * 12.3.0 puts `R` beside the column and runs `Q --> W` straight down; each of
 * the three edges takes a port of its own.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const SRC = 'graph TD\n  Q[Queue] --> W[Worker]\n  Q --> R[Retry]\n  R --> W'

const render = (o: object = {}): string[] =>
  renderMermaidASCII(SRC, { colorMode: 'none', ...o })
    .split('\n')
    .map((r) => r.trimEnd())

describe('TD bypass edge beside the node it skips (#2731)', () => {
  it('draws Retry beside the spine, one port and one head per edge', () => {
    expect(render()).toEqual([
      '┌────────┐',
      '│        │',
      '│ Queue  │',
      '│        │',
      '└────┬─┬─┘',
      '     │ │',
      '     │ └───────────┐',
      '     │             │',
      '     │             │',
      '     │             ▼',
      '     │         ┌───────┐',
      '     │         │       │',
      '     │         │ Retry │',
      '     │         │       │',
      '     │         └───┬───┘',
      '     │             │',
      '     │             │',
      '     │             │',
      '     │ ┌───────────┘',
      '     ▼ ▼',
      '┌────────┐',
      '│        │',
      '│ Worker │',
      '│        │',
      '└────────┘',
    ])
  })

  it('keeps the old layout when the gap is too small for a port and a lane', () => {
    const out = render({ paddingY: 1 }).join('\n')
    expect(out).not.toMatch(/▼ ▼/)
  })

  it('steps aside every triangle in a chain', () => {
    const out = renderMermaidASCII(
      'graph TD\n  A --> B\n  B --> C\n  A --> C\n  C --> D\n  D --> E\n  C --> E',
      { colorMode: 'none' },
    )
    // Two skipped nodes, B and D, each beside the spine: two heads per target.
    expect(out.match(/▼ ▼/g)).toHaveLength(2)
  })
})
