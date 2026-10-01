/**
 * Regression tests for #1197: a flowchart whose edges form a cycle across
 * sibling subgraphs (`A --> C --> E --> A`, each node in its own subgraph)
 * threw `Node "A" has no gridCoord` from `renderMermaidASCII`.
 *
 * Cause: `createMapping` seeds a cycle that has no true root with a
 * pseudo-root, then dropped any root with an incoming edge from outside its
 * own subgraph — which, in a cross-subgraph cycle, is always the pseudo-root,
 * so nothing seeded the component and no node was ever placed.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const lines = (s: string): string[] => s.split('\n')

const cases: Record<string, string> = {}
for (const dir of ['TD', 'LR']) {
  for (const lbl of [false, true]) {
    const l = (s: string): string => (lbl ? `|${s}|` : '')
    const tag = `${dir}${lbl ? ' labelled' : ''}`
    cases[`two sibling subgraphs ${tag}`] =
      `graph ${dir}\nsubgraph S1[One]\nA\nend\nsubgraph S2[Two]\nB\nend\nA -->${l('x')} B\nB -->${l('y')} A`
    cases[`three sibling subgraphs ${tag}`] =
      `graph ${dir}\nsubgraph S1[One]\nA\nend\nsubgraph S2[Two]\nC\nend\nsubgraph S3[Three]\nE\nend\nA -->${l('x')} C\nC -->${l('y')} E\nE -->${l('z')} A`
    cases[`nested subgraphs ${tag}`] =
      `graph ${dir}\nsubgraph O[Outer]\nsubgraph I1[In1]\nA\nend\nsubgraph I2[In2]\nB\nend\nend\nsubgraph P[Pee]\nC\nend\nA -->${l('x')} B\nB --> C\nC --> A`
  }
}

/** Node ids declared as a bare line or edge endpoint, per the sources above. */
const NODES = ['A', 'B', 'C', 'E']

describe('#1197: cycle across sibling subgraphs', () => {
  for (const [name, src] of Object.entries(cases)) {
    describe(name, () => {
      for (const useAscii of [false, true]) {
        it(`renders without throwing, one box per node (${useAscii ? 'ascii' : 'unicode'})`, () => {
          const out = renderMermaidASCII(src, { useAscii, colorMode: 'none' })
          for (const id of NODES) {
            if (!new RegExp(`^\\s*${id}\\b`, 'm').test(src)) continue
            // each node label appears exactly once (titles never contain it)
            const hits = out.match(new RegExp(`\\s${id}\\s`, 'g')) ?? []
            expect(hits, `node ${id}`).toHaveLength(1)
          }
        })
      }
      // A mutual `A --> B`, `B --> A` pair with labels shares one corridor and
      // the label overwrites the next frame's title — an independent
      // edge-routing defect that also reproduces on main when an unrelated root
      // seeds the layout, so it is not asserted here.
      const mutualLabelled =
        name.startsWith('two sibling') && name.endsWith('labelled')
      if (!mutualLabelled) {
        it('every declared subgraph title is drawn', () => {
          const out = renderMermaidASCII(src, { colorMode: 'none' })
          for (const m of src.matchAll(/subgraph \w+\[(\w+)\]/g)) {
            expect(out).toContain(m[1]!)
          }
        })
      }
    })
  }

  it('the issue example (Layer One/Two/Three) renders every box inside its subgraph frame', () => {
    const src = `graph TD
subgraph L1[Layer One]
  A
end
subgraph L2[Layer Two]
  C
end
subgraph L3[Layer Three]
  E
end
A --> C
C --> E
E --> A`
    const out = lines(renderMermaidASCII(src, { colorMode: 'none' }))
    for (const [title, id] of [
      ['Layer One', 'A'],
      ['Layer Two', 'C'],
      ['Layer Three', 'E'],
    ] as const) {
      const titleRow = out.findIndex((ln) => ln.includes(title))
      const nodeRow = out.findIndex((ln) =>
        new RegExp(`│\\s+${id}\\s+[│├]`).test(ln),
      )
      expect(titleRow, title).toBeGreaterThanOrEqual(0)
      expect(nodeRow, id).toBeGreaterThan(titleRow)
      // the next subgraph title (if any) comes after the node: box is inside its own frame
      const nextTitleRow = out.findIndex(
        (ln, i) => i > titleRow && /Layer (One|Two|Three)/.test(ln),
      )
      if (nextTitleRow !== -1) expect(nodeRow).toBeLessThan(nextTitleRow)
    }
  })
})
