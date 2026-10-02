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
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { convertToAsciiGraph } from '../converter.ts'
import { createMapping, gridToDrawingCoord } from '../grid.ts'
import {
  DEFAULT_PADDING_X,
  DEFAULT_PADDING_Y,
  DEFAULT_BOX_BORDER_PADDING,
} from '../types.ts'

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
      // Edge labels stay off frame title rows (#1254), so the mutual
      // labelled pair keeps its titles too.
      it('every declared subgraph title is drawn', () => {
        const out = renderMermaidASCII(src, { colorMode: 'none' })
        for (const m of src.matchAll(/subgraph \w+\[(\w+)\]/g)) {
          expect(out).toContain(m[1]!)
        }
      })
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
      // the title is never split by an edge entering the frame (#1248)
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

/**
 * Defects found reviewing the #1197 render in a real terminal: the back-edge
 * ran up through the interior of the frames it merely passes (so it read as
 * belonging to them) and through their titles. Mermaid routes it outside.
 */
function drawnEdgeCells(src: string) {
  const graph = convertToAsciiGraph(parseMermaid(src), {
    useAscii: false,
    paddingX: DEFAULT_PADDING_X,
    paddingY: DEFAULT_PADDING_Y,
    boxBorderPadding: DEFAULT_BOX_BORDER_PADDING,
    graphDirection: /^\s*graph\s+LR/.test(src) ? 'LR' : 'TD',
  })
  createMapping(graph)
  const out: { edge: string; x: number; y: number; sg: string }[] = []
  for (const edge of graph.edges) {
    const pts = edge.path.map((c) => gridToDrawingCoord(graph, c))
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!
      const b = pts[i]!
      const n = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
      for (let k = 0; k <= n; k++) {
        const x = a.x + Math.sign(b.x - a.x) * Math.min(k, Math.abs(b.x - a.x))
        const y = a.y + Math.sign(b.y - a.y) * Math.min(k, Math.abs(b.y - a.y))
        for (const sg of graph.subgraphs) {
          // Unrelated frame: neither endpoint lives in it.
          if (sg.nodes.includes(edge.from) || sg.nodes.includes(edge.to)) {
            continue
          }
          if (x > sg.minX && x < sg.maxX && y > sg.minY && y < sg.maxY) {
            out.push({
              edge: `${edge.from.name}->${edge.to.name}`,
              x,
              y,
              sg: sg.name,
            })
          }
        }
      }
    }
  }
  return out
}

const LAYERS = (dir: string): string => `graph ${dir}
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

const outsideCases: Record<string, string> = {
  ...cases,
  'issue example TD (long titles)': LAYERS('TD'),
  'issue example LR (long titles)': LAYERS('LR'),
  'nested, long titles': `graph TD
subgraph O[Outer Frame]
subgraph I1[Inner One]
A
end
subgraph I2[Inner Two]
B
end
end
subgraph P[Peer Frame]
C
end
A --> B
B --> C
C --> A`,
  'four layers, long titles': `graph TD
subgraph L1[Layer One]
  A
end
subgraph L2[Layer Two]
  B
end
subgraph L3[Layer Three]
  C
end
subgraph L4[Layer Four]
  D
end
A --> B
B --> C
C --> D
D --> A`,
}

describe('#1197: edges stay out of frames they neither start nor end in', () => {
  for (const [name, src] of Object.entries(outsideCases)) {
    it(`no edge cell (hence no title overdraw) inside an unrelated frame: ${name}`, () => {
      expect(drawnEdgeCells(src)).toEqual([])
    })
  }
})
