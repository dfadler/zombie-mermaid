/**
 * Regression tests for upstream lukilabs/beautiful-mermaid#63: an LR fan-in
 * followed by a fan-out (`A --> C`, `B --> C`, `C --> D`, `C --> E`).
 *
 * Upstream's bug: C->E was routed along B->C's corridor, so B's row rendered a
 * misleading `├───┴──►E`, as if B pointed at E. The fixed shape has C->E on its
 * own trunk (`┬` off C's right side, then `└────┐` down to E) while B->C ends
 * at `┘` under C.
 *
 * This fork fixes it through findUnrelatedOverlap / createEdgeCellOwners
 * (edge-cell-styles.ts) via rerouteAroundStyleConflicts (grid.ts), not by
 * porting upstream's routing change; these tests pin the rendered outcome, not
 * the mechanism.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const lines = (s: string): string[] => s.split('\n').map((l) => l.trimEnd())

const SOURCE = `graph LR
A --> C
B --> C
C --> D
C --> E`

describe('upstream #63: LR fan-in then fan-out keeps C->E off B->C corridor', () => {
  it('renders C->E on its own trunk (unicode)', () => {
    expect(lines(renderMermaidASCII(SOURCE, { colorMode: 'none' }))).toEqual([
      '┌───┐     ┌───┐     ┌───┐',
      '│   │     │   │     │   │',
      '│ A ├────►│ C ├──┬─►│ D │',
      '│   │     │   │  │  │   │',
      '└───┘     └───┘  │  └───┘',
      '            ▲    │',
      '            │    │',
      '            │    └────┐',
      '            │         │',
      '            │         ▼',
      '┌───┐       │       ┌───┐',
      '│   │       │       │   │',
      '│ B ├───────┘       │ E │',
      '│   │               │   │',
      '└───┘               └───┘',
    ])
  })

  it('B row ends at the corner under C and never reaches E (unicode)', () => {
    const out = lines(renderMermaidASCII(SOURCE, { colorMode: 'none' }))
    const bRow = out.find((l) => l.includes('│ B ├'))!
    // B's edge terminates at exactly one `┘`; nothing horizontal after it.
    expect(bRow.match(/┘/g)).toHaveLength(1)
    expect(bRow.slice(bRow.indexOf('┘') + 1)).not.toMatch(/[─├┴┬►]/)
    // The misleading tee joining B's corridor to E must not appear anywhere.
    expect(out.join('\n')).not.toContain('┴')
  })

  it('renders the same shape with the ASCII charset', () => {
    expect(
      lines(renderMermaidASCII(SOURCE, { colorMode: 'none', useAscii: true })),
    ).toEqual([
      '+---+     +---+     +---+',
      '|   |     |   |     |   |',
      '| A +---->| C +--+->| D |',
      '|   |     |   |  |  |   |',
      '+---+     +---+  |  +---+',
      '            ^    |',
      '            |    |',
      '            |    +----+',
      '            |         |',
      '            |         v',
      '+---+       |       +---+',
      '|   |       |       |   |',
      '| B +-------+       | E |',
      '|   |               |   |',
      '+---+               +---+',
    ])
  })
})
