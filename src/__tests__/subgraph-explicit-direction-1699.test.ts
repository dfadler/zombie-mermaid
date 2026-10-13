/**
 * #1699: a subgraph's explicit `direction` is kept unless an edge crosses its
 * boundary or an ancestor's. An edge to or from the subgraph's own id does not
 * cross it. Expected values read from mermaid 12.1.0 (latest at the time) in
 * headless Chromium; mermaid.live and GitHub render the same layout. Mermaid
 * 11.17.2 agrees on every row here. (11.17.2 also flips a subgraph with no
 * `direction`; 12.x does not, and neither do we.)
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '../index.ts'
import { layoutFlowchartSync } from '@zombie-mermaid/svg-renderer'

const sub = (dir: string, extra = '') =>
  `subgraph S\n    ${dir ? `direction ${dir}\n    ` : ''}a --> b --> c\n  end\n  ${extra}`
const nest = (pre: string, post = '') =>
  `graph TD\n  ${pre}subgraph O\n    subgraph I\n      direction LR\n      a --> b --> c\n    end\n  end${post}`

const cases: Array<[string, string, 'row' | 'col']> = [
  ['TD, no direction', `graph TD\n  ${sub('')}`, 'col'],
  ['LR, no direction', `graph LR\n  ${sub('')}`, 'row'],
  ['explicit LR in TD', `graph TD\n  ${sub('LR')}`, 'row'],
  ['explicit LR, X --> S', `graph TD\n  X --> S\n  ${sub('LR')}`, 'row'],
  ['explicit LR, S --> Y', `graph TD\n  ${sub('LR', 'S --> Y')}`, 'row'],
  ['explicit LR, X --> a', `graph TD\n  X --> a\n  ${sub('LR')}`, 'col'],
  ['explicit LR, c --> Y', `graph TD\n  ${sub('LR', 'c --> Y')}`, 'col'],
  ['explicit TB in LR, X --> S', `graph LR\n  X --> S\n  ${sub('TB')}`, 'col'],
  ['explicit TB in LR, X --> a', `graph LR\n  X --> a\n  ${sub('TB')}`, 'row'],
  ['explicit TB in TD, X --> S', `graph TD\n  X --> S\n  ${sub('TB')}`, 'col'],
  [
    'explicit LR, S --> T',
    `graph TD\n  ${sub('LR')}\n  subgraph T\n    d --> e\n  end\n  S --> T`,
    'row',
  ],
  [
    'explicit LR, c --> d',
    `graph TD\n  ${sub('LR')}\n  subgraph T\n    d --> e\n  end\n  c --> d`,
    'col',
  ],
  ['nested, none', nest(''), 'row'],
  ['nested, X --> O', nest('X --> O\n  '), 'row'],
  ['nested, O --> Y', nest('', '\n  O --> Y'), 'row'],
  ['nested, X --> I crosses the parent', nest('X --> I\n  '), 'col'],
  ['nested, I --> Y crosses the parent', nest('', '\n  I --> Y'), 'col'],
  ['nested, X --> a', nest('X --> a\n  '), 'col'],
]

function orientation(source: string): 'row' | 'col' {
  const nodes = layoutFlowchartSync(parseMermaid(source)).nodes
  const picked = ['a', 'b', 'c'].map((id) => nodes.find((n) => n.id === id)!)
  const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs)
  return spread(picked.map((n) => n.x)) > spread(picked.map((n) => n.y))
    ? 'row'
    : 'col'
}

describe('explicit subgraph direction matches mermaid 12.1.0 (#1699)', () => {
  it.each(cases)('%s', (_name, source, expected) => {
    expect(orientation(source)).toBe(expected)
  })
})
