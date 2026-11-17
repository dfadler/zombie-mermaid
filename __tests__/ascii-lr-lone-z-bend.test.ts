/**
 * A Z-shaped edge that shares its gap with nothing it could merge with bends
 * on the gap's middle column, where mermaid@12.3.0 bends it (checked by
 * rendering these sources through the real package: A->C and B->C of `fanIn`
 * and B->C of `chain` all bend at 0.50 of the gap). `AsciiEdgeHint.bend` is
 * read from the layout with mermaid's real node sizes for that reason; the
 * legacy-size layout bends them at 0.25.
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'
import { readGrid } from '../scripts/lib/ascii-topology.ts'
import { parseMermaid } from '../packages/mermaid-parser/src/index.ts'

const chain = (dir: string): string => `flowchart ${dir}
    A --> B
    B --> C
    C --> D
    A --> C`

const fanIn = (dir: string): string => `flowchart ${dir}
  A[Input] & B[Config] --> C[Processor]
  C --> D[Output] & E[Log]`

const drawnBend = (src: string, from: string, to: string): number | undefined =>
  readGrid(src).edges.find((e) => e.from === from && e.to === to)?.bend

describe('lone Z bend column (LR/RL)', () => {
  it.each(['LR', 'RL'])('%s: the bypass chain’s B->C bends mid-gap', (d) => {
    expect(drawnBend(chain(d), 'B', 'C')).toBeCloseTo(0.5, 1)
  })

  it.each(['LR', 'RL'])(
    '%s: two Z strokes into one hub share the mid-gap bend column',
    (d) => {
      expect(drawnBend(fanIn(d), 'A', 'C')).toBeCloseTo(0.5, 1)
      expect(drawnBend(fanIn(d), 'B', 'C')).toBeCloseTo(0.5, 1)
    },
  )

  it('the hint is the real-size layout’s middle, not the legacy 0.25', () => {
    const hints = asciiLayoutProvider.graph!(parseMermaid(fanIn('LR')))!
    const bend = hints.edges.find((e) => e.from === 'A' && e.to === 'C')!.bend!
    expect(bend).toBeCloseTo(0.5, 1)
  })

  // The strokes out of the hub still bend at 0.33 where mermaid@12.3.0 bends at 0.50 (open, #2886).
  it('LR: the two Z strokes into the hub bend on the gap’s middle column', () => {
    registerAsciiLayout(asciiLayoutProvider)
    const text = renderMermaidASCII(fanIn('LR'), {
      colorMode: 'none',
      layoutHints: true,
    })
    expect(text.split('\n').map((l) => l.trimEnd())).toEqual([
      '┌────────┐                       ┌────────┐',
      '│        │                       │        │',
      '│ Input  ├──┐                ┌──►│ Output │',
      '│        │  │                │   │        │',
      '└────────┘  │  ┌───────────┐ │   └────────┘',
      '            └─►│           ├─┘',
      '               │ Processor │',
      '            ┌─►│           ├─┐',
      '┌────────┐  │  └───────────┘ │   ┌────────┐',
      '│        │  │                │   │        │',
      '│ Config ├──┘                └──►│  Log   │',
      '│        │                       │        │',
      '└────────┘                       └────────┘',
    ])
  })
})
