/**
 * Regression tests for upstream lukilabs/beautiful-mermaid#63: an LR fan-in
 * followed by a fan-out (`A --> C`, `B --> C`, `C --> D`, `C --> E`).
 *
 * Upstream's bug: C->E was routed along B->C's corridor, so B's row rendered a
 * misleading `├───┴──►E`, as if B pointed at E. The fixed shape keeps C->E on
 * its own trunk, off B->C's corridor. Since #2163 C is centred over D and E,
 * so C->D and C->E leave its top and bottom borders.
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
      '┌───┐               ┌───┐',
      '│   │               │   │',
      '│ A │       ┌──────►│ D │',
      '│   │       │       │   │',
      '└─┬─┘     ┌─┴─┐     └───┘',
      '  │       │   │',
      '  ├──────►│ C │',
      '  │       │   │',
      '┌─┴─┐     └─┬─┘     ┌───┐',
      '│   │       │       │   │',
      '│ B │       └──────►│ E │',
      '│   │               │   │',
      '└───┘               └───┘',
    ])
  })

  it('B row has no edge running past it towards E (unicode)', () => {
    const out = lines(renderMermaidASCII(SOURCE, { colorMode: 'none' }))
    const bRow = out.find((l) => l.includes('│ B │'))!
    // B->C leaves B's top border, so nothing joins B's box to the trunk that
    // feeds E on the same row.
    expect(bRow).toMatch(/^│ B │ +└──────►│ E │$/)
  })

  it('renders the same shape with the ASCII charset', () => {
    expect(
      lines(renderMermaidASCII(SOURCE, { colorMode: 'none', useAscii: true })),
    ).toEqual([
      '+---+               +---+',
      '|   |               |   |',
      '| A |       +------>| D |',
      '|   |       |       |   |',
      '+-+-+     +-+-+     +---+',
      '  |       |   |',
      '  +------>| C |',
      '  |       |   |',
      '+-+-+     +-+-+     +---+',
      '|   |       |       |   |',
      '| B |       +------>| E |',
      '|   |               |   |',
      '+---+               +---+',
    ])
  })
})
