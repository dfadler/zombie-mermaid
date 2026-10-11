/**
 * #1699: mermaid.js lays a subgraph with no edge crossing its boundary out
 * perpendicular to its parent, unless it states a `direction`. A subgraph with
 * a crossing edge ignores its `direction` and follows its parent. An edge to
 * or from the subgraph's own id does not cross.
 *
 * Every row's expected orientation was read from mermaid 11.17.2 rendered in
 * headless Chromium (`scripts/lib/real-mermaid.ts`), by the positions of the
 * nodes inside the subgraph.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../index.ts'
import { layoutFlowchartSync } from '@zombie-mermaid/svg-renderer'

type Orientation = 'row' | 'col'

/** Whether `ids` sit along a row or a column once laid out. */
function orientation(source: string, ids: string[]): Orientation {
  const nodes = layoutFlowchartSync(parseMermaid(source)).nodes
  const picked = ids.map((id) => nodes.find((n) => n.id === id)!)
  const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs)
  return spread(picked.map((n) => n.x)) > spread(picked.map((n) => n.y))
    ? 'row'
    : 'col'
}

const S = 'subgraph S\n    a --> b --> c\n  end'
const ABC = ['a', 'b', 'c']

const cases: Array<[string, string, Orientation, string[]?]> = [
  ['TD, no direction', `graph TD\n  ${S}`, 'row'],
  ['LR, no direction', `graph LR\n  ${S}`, 'col'],
  ['BT, no direction', `graph BT\n  ${S}`, 'col'],
  ['RL, no direction', `graph RL\n  ${S}`, 'col'],
  [
    'explicit LR in TD',
    'graph TD\n  subgraph S\n    direction LR\n    a --> b --> c\n  end',
    'row',
  ],
  [
    'explicit TB in TD',
    'graph TD\n  subgraph S\n    direction TB\n    a --> b --> c\n  end',
    'col',
  ],
  ['edge to the id, X --> S', `graph TD\n  X --> S\n  ${S}`, 'row'],
  ['edge from the id, S --> Y', `graph TD\n  ${S}\n  S --> Y`, 'row'],
  [
    'explicit LR with X --> S',
    'graph TD\n  X --> S\n  subgraph S\n    direction LR\n    a --> b --> c\n  end',
    'row',
  ],
  ['edge into a member, X --> a', `graph TD\n  X --> a\n  ${S}`, 'col'],
  ['edge out of a member, c --> Y', `graph TD\n  ${S}\n  c --> Y`, 'col'],
  [
    'explicit LR ignored with X --> a',
    'graph TD\n  X --> a\n  subgraph S\n    direction LR\n    a --> b --> c\n  end',
    'col',
  ],
  [
    'nested: inner flips twice back to the root axis',
    'graph TD\n  subgraph O\n    subgraph I\n      a --> b --> c\n    end\n  end',
    'col',
  ],
  [
    'nested: edge to the inner id',
    'graph TD\n  X --> I\n  subgraph O\n    subgraph I\n      a --> b --> c\n    end\n  end',
    'row',
  ],
  [
    'nested: edge to the outer id',
    'graph TD\n  X --> O\n  subgraph O\n    subgraph I\n      a --> b --> c\n    end\n  end',
    'col',
  ],
  [
    'nested: edge into a deep member crosses both',
    'graph TD\n  X --> a\n  subgraph O\n    subgraph I\n      a --> b --> c\n    end\n  end',
    'col',
  ],
  [
    'nested: outer member leaves the outer only',
    'graph TD\n  subgraph O\n    subgraph I\n      a --> b --> c\n    end\n  end\n  c --> Y',
    'col',
  ],
  [
    'cluster to cluster edge',
    'graph TD\n  subgraph S\n    a --> b --> c\n  end\n  subgraph T\n    d --> e --> f\n  end\n  S --> T',
    'row',
  ],
  [
    'member to member across clusters',
    'graph TD\n  subgraph S\n    a --> b --> c\n  end\n  subgraph T\n    d --> e --> f\n  end\n  c --> d',
    'col',
  ],
  [
    'nested: parent with its own members flips',
    'graph LR\n  subgraph O\n    p --> q --> r\n    subgraph I\n      a --> b --> c\n    end\n  end',
    'col',
    ['p', 'q', 'r'],
  ],
  [
    'nested: its child flips back',
    'graph LR\n  subgraph O\n    p --> q --> r\n    subgraph I\n      a --> b --> c\n    end\n  end',
    'row',
  ],
]

describe('subgraph inner direction matches mermaid.js (#1699)', () => {
  it.each(cases)('%s', (_name, source, expected, ids) => {
    expect(orientation(source, ids ?? ABC)).toBe(expected)
  })

  it('keeps a flipped row on one line when a sibling node and subgraph share the graph', () => {
    const p = layoutFlowchartSync(
      parseMermaid(
        'graph TD\n  subgraph S\n    a --> b --> c\n  end\n  subgraph T\n    d --> e\n  end\n  X --> T',
      ),
    )
    const y = (id: string) => p.nodes.find((n) => n.id === id)!.y
    expect(new Set(['a', 'b', 'c'].map(y)).size).toBe(1)
    expect(new Set(['d', 'e'].map(y)).size).toBe(1)
    // mermaid.js: the first subgraph is left of X, and X sits on the row of a, b, c
    const x = (id: string) => p.nodes.find((n) => n.id === id)!.x
    expect(x('c')).toBeLessThan(x('X'))
    expect(y('X')).toBe(y('a'))
  })

  it('stacks two unconnected sibling subgraphs perpendicular to the flow', () => {
    const p = layoutFlowchartSync(
      parseMermaid(
        'graph LR\n  subgraph S1\n    A --> B\n  end\n  subgraph S2\n    C --> D\n  end',
      ),
    )
    const [g1, g2] = p.groups
    expect(g1!.x).toBe(g2!.x)
    expect(g1!.y).not.toBe(g2!.y)
  })
})
