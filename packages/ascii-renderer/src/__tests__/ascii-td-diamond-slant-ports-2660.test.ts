/**
 * #2660: a TD decision's two branches leave its bottom face from the lower
 * slants, one each side of the vertex (mermaid@12.3.0 draws them there), not as
 * two stems under the vertex.
 */
import { afterEach, describe, it, expect } from 'vitest'
import {
  registerAsciiLayout,
  renderMermaidASCII,
} from '@zombie-mermaid/ascii-renderer'
import { asciiLayoutProvider } from '../../../../src/ascii-layout-provider.ts'

afterEach(() => registerAsciiLayout(undefined))

const SRC =
  'graph TD\n  A[Start] --> B{Ok?}\n  B -->|Yes| C[Go]\n  B -->|No| D[Stop]'

const render = (o: object = {}): string[] => {
  registerAsciiLayout(asciiLayoutProvider)
  return renderMermaidASCII(SRC, { colorMode: 'none', ...o })
    .split('\n')
    .map((r) => r.trimEnd())
}

describe('TD decision branches leave the lower slants (#2660)', () => {
  it('draws each branch outside the vertex row, a stem of its own', () => {
    expect(render().slice(10, 18)).toEqual([
      '         ╱─╲',
      '        ╱   ╲',
      '      <  Ok?  >',
      '        ╲   ╱',
      '        │╲─╱│',
      '        │   │',
      '   ┌────┘   └─────┐',
      '   │              │',
    ])
  })

  it('does the same in the ASCII charset', () => {
    const rows = render({ useAscii: true })
    const i = rows.findIndex((r) => r.includes('\\-/'))
    expect(rows[i]!.indexOf('|')).toBeLessThan(rows[i]!.indexOf('\\'))
    expect(rows[i]!.lastIndexOf('|')).toBeGreaterThan(rows[i]!.indexOf('/'))
  })

  // A decision entered from above that also sends an edge back up takes both
  // on its top face: the entry on the upper-left slant, the back edge on the
  // upper-right one (mermaid@12.3.0), not two stems at the top vertex.
  it('puts an entry and a back edge on the two upper slants', () => {
    registerAsciiLayout(asciiLayoutProvider)
    const rows = renderMermaidASCII(
      'graph TD\n  subgraph ci [CI]\n    A[Push] --> B{Pass?}\n    B -->|Yes| C[Build]\n    B -->|No| D[Fix]\n    D -.-> A\n  end\n  C --> E([Deploy])\n  E --> F{QA?}\n  F -->|Yes| G((Prod))\n  F -->|No| D',
      { colorMode: 'none' },
    )
      .split('\n')
      .map((r) => r.trimEnd())
    // The last `╱─╲` is the QA decision's top vertex.
    const top = rows.findLastIndex((r) => r.includes('╱─╲'))
    const above = rows[top - 1]!
    const vertex = rows[top]!.indexOf('╱─╲')
    expect(above.slice(0, vertex)).toMatch(/[▼│]/)
    expect(above.slice(vertex + 3)).toMatch(/[│▲]/)
    expect(above[vertex + 1]).toBe(' ')
  })
})
