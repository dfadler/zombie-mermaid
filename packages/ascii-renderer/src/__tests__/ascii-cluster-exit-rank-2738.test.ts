/**
 * A node linked from inside a subgraph ranks below the whole cluster, and a
 * member's own targets sit left of the cluster-addressed ones, as
 * mermaid@12.3.0 draws it (#2738).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../index.ts'
import { checkAll } from '../../../../__tests__/helpers/ascii-invariants.ts'

const SRC = `flowchart TD
  In[Request] --> A
  subgraph Cluster
    A --> B
    B --> C
  end
  Cluster --> X[Cache]
  Cluster --> Y[Log]
  B --> Z[Audit]
  C --> W[Reply]`

const render = (s: string, useAscii = false): string[] =>
  renderMermaidASCII(s, { colorMode: 'none', useAscii }).split('\n')

describe('cluster exits rank below the whole cluster (#2738)', () => {
  it.each([false, true])(
    'four targets in one row, mermaid order (ascii=%s)',
    (useAscii) => {
      const lines = render(SRC, useAscii)
      const row = lines.find((l) => l.includes('Audit'))!
      // mermaid@12.3.0: Audit, Reply, Cache, Log, all on one row.
      expect(row.replace(/[^A-Za-z]+/g, ' ').trim()).toBe(
        'Audit Reply Cache Log',
      )
      // The cluster frame ends above that row.
      const frameEnd = lines.findLastIndex((l) => /^[└+]-*|^└/.test(l))
      expect(frameEnd).toBeLessThan(lines.indexOf(row))
    },
  )

  it('draws no run along the row the arrowheads end on', () => {
    const out = renderMermaidASCII(SRC, { colorMode: 'none' })
    expect(checkAll(out, { unicode: true }).map((v) => v.message)).toEqual([])
  })

  it('a single-member cluster keeps declaration order', () => {
    const lines = render(`flowchart TD
  subgraph S
    a
  end
  S --> C
  a --> D`)
    const row = lines.find((l) => l.includes('C'))!
    expect(row.indexOf('C')).toBeLessThan(row.indexOf('D'))
  })
})
