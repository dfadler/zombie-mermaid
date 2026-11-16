/**
 * A Z-shaped edge that shares its gap with nothing it could merge with still
 * bends where mermaid@12.3.0 (ELK) bends it, not on the gap's middle column.
 * The gap's bend column is aimed on the scale from the start face to the end
 * face, which is the scale `AsciiEdgeHint.bend` is on.
 */
import { describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../packages/ascii-renderer/src/index.ts'
import { asciiLayoutProvider } from '../src/ascii-layout-provider.ts'
import { measureSample } from '../scripts/lib/ascii-topology.ts'

const chain = (dir: string): string => `flowchart ${dir}
    A --> B
    B --> C
    C --> D
    A --> C`

const fanIn = (dir: string): string => `flowchart ${dir}
  A[Input] & B[Config] --> C[Processor]
  C --> D[Output] & E[Log]`

describe('lone Z bend column (LR/RL)', () => {
  it.each(['LR', 'RL'])(
    '%s: a bypass chain bends every Z on ELK’s side',
    (d) => {
      const c = measureSample(chain(d))
      expect(c.bends).toBeGreaterThan(0)
      expect(c.bendOk).toBe(c.bends)
    },
  )

  it.each(['LR', 'RL'])(
    '%s: two Z strokes into one hub share one bend column on ELK’s side',
    (d) => {
      const c = measureSample(fanIn(d))
      expect(c.bendOk).toBe(c.bends)
    },
  )

  it('LR: the two Z strokes into the hub bend beside their sources (ELK’s 0.3), not mid-gap', () => {
    registerAsciiLayout(asciiLayoutProvider)
    const text = renderMermaidASCII(fanIn('LR'), {
      colorMode: 'none',
      layoutHints: true,
    })
    expect(text.split('\n').map((l) => l.trimEnd())).toEqual([
      '┌────────┐                       ┌────────┐',
      '│        │                       │        │',
      '│ Input  ├─┐                 ┌──►│ Output │',
      '│        │ │                 │   │        │',
      '└────────┘ │   ┌───────────┐ │   └────────┘',
      '           └──►│           ├─┘',
      '               │ Processor │',
      '           ┌──►│           ├─┐',
      '┌────────┐ │   └───────────┘ │   ┌────────┐',
      '│        │ │                 │   │        │',
      '│ Config ├─┘                 └──►│  Log   │',
      '│        │                       │        │',
      '└────────┘                       └────────┘',
    ])
  })
})
