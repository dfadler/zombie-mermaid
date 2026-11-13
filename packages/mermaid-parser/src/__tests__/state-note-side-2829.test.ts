import { describe, expect, it } from 'vitest'
import { parseMermaid } from '../index.ts'

// mermaid@12.3.0 links `note right of X` as X -> note and `note left of X` as
// note -> X, so a left note ranks above its state.
const links = (src: string): string[] =>
  parseMermaid(src)
    .edges.filter((e) => e.style === 'dotted')
    .map((e) => `${e.source}>${e.target}`)

describe('state note side (#2829)', () => {
  it('links a right note from the state and a left note into it', () => {
    expect(
      links(
        'stateDiagram-v2\n  A --> B\n  note right of A : r\n  note left of B : l',
      ),
    ).toEqual(['A>A----note-1', 'B----note-2>B'])
  })

  it('handles a left block note and lists it before its state', () => {
    const g = parseMermaid(
      'stateDiagram-v2\n  A --> B\n  note left of B\n    l1\n    l2\n  end note',
    )
    expect(links('stateDiagram-v2\n  A --> B\n  note left of B : x')).toEqual([
      'B----note-1>B',
    ])
    const ids = [...g.nodes.keys()]
    expect(ids.indexOf('B----note-1')).toBeLessThan(ids.indexOf('B'))
  })

  it('keeps a left note ahead of its state inside a composite', () => {
    const g = parseMermaid(
      'stateDiagram-v2\n  state C {\n    X --> Y\n    note left of Y : n\n  }',
    )
    const ids = g.subgraphs[0]!.nodeIds
    expect(ids.indexOf('Y----note-1')).toBeLessThan(ids.indexOf('Y'))
  })
})
