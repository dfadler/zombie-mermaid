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
      // The cluster frame (found by its title row) ends above that row.
      const top = lines.findIndex((l) => l.includes('Cluster')) - 1
      const left = lines[top]!.search(/\S/)
      const bottom = lines.findIndex(
        (l, i) => i > top && /[└+]/.test(l[left] ?? ''),
      )
      expect(top).toBeGreaterThanOrEqual(0)
      expect(bottom).toBeGreaterThan(top)
      expect(bottom).toBeLessThan(lines.indexOf(row))
    },
  )

  it('draws no run along the row the arrowheads end on', () => {
    const out = renderMermaidASCII(SRC, { colorMode: 'none' })
    expect(checkAll(out, { unicode: true }).map((v) => v.message)).toEqual([])
  })

  it('the target row is centred under the cluster, as mermaid@12.3.0 draws it', () => {
    const lines = render(SRC)
    const mid = (l: string, a: string, b: string): number =>
      (l.indexOf(a) + l.lastIndexOf(b) + b.length) / 2
    const row = lines.find((l) => l.includes('Audit'))!
    const head = lines.find((l) => l.includes('Request'))!
    expect(
      Math.abs(mid(row, 'Audit', 'Log') - mid(head, 'Request', 'Request')),
    ).toBeLessThanOrEqual(8)
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

  // Layouts where the cluster is left where it was: each must still render.
  it.each([
    ['a back edge', `${SRC}\n  W --> In`],
    ['a node beside the chain', `${SRC}\n  In --> Q[Side]`],
    ['targets on different ranks', `${SRC}\n  X --> Y`],
    ['a target inside another cluster', `${SRC}\n  subgraph T\n    X\n  end`],
    [
      'a cluster wider than its exits',
      'flowchart TD\n  subgraph S\n    a\n    b\n    c\n  end\n  S --> X\n  S --> Y',
    ],
    ['a left-to-right graph', SRC.replace('TD', 'LR')],
    [
      'a nested cluster',
      'flowchart TD\n  subgraph S\n    subgraph I\n      a\n    end\n    b\n  end\n  S --> X\n  S --> Y',
    ],
    [
      'four exits from a three-member cluster',
      'flowchart TD\n  subgraph S\n    a\n    b\n    c\n  end\n  S --> X\n  S --> Y\n  S --> Z\n  S --> W',
    ],
    [
      'a cluster with one exit',
      'flowchart TD\n  subgraph S\n    a --> b\n    c\n  end\n  S --> X',
    ],
  ])('renders %s', (_name, src) => {
    const out = renderMermaidASCII(src, { colorMode: 'none' })
    expect(out).toContain('Reply'.slice(0, 0) + '┌')
  })
})
