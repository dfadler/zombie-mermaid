/**
 * Regression tests for two subgraph-frame defects:
 *
 * - #1252: a node that is not a member of a subgraph (it only has an edge
 *   *into* it) was drawn inside that subgraph's frame, because level-based
 *   placement put it in a column the frame's members span.
 * - #1254: an edge label overwrote a letter of the next frame's title
 *   (`Two` -> `Txo`), and in LR a frame narrower than its title clipped the
 *   title (`Layer Two` -> `Layer T`).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { convertToAsciiGraph } from '../converter.ts'
import { createMapping } from '../grid.ts'
import type { AsciiNode, AsciiSubgraph } from '../types.ts'
import {
  DEFAULT_PADDING_X,
  DEFAULT_PADDING_Y,
  DEFAULT_BOX_BORDER_PADDING,
} from '../types.ts'

function layout(src: string) {
  const graph = convertToAsciiGraph(parseMermaid(src), {
    useAscii: false,
    paddingX: DEFAULT_PADDING_X,
    paddingY: DEFAULT_PADDING_Y,
    boxBorderPadding: DEFAULT_BOX_BORDER_PADDING,
    graphDirection: /^\s*graph\s+LR/.test(src) ? 'LR' : 'TD',
  })
  createMapping(graph)
  return graph
}

function members(sg: AsciiSubgraph): AsciiNode[] {
  return [...sg.nodes, ...sg.children.flatMap(members)]
}

/** Drawn box of a node: [minX, minY, maxX, maxY] in drawing coordinates. */
function nodeBox(n: AsciiNode): [number, number, number, number] {
  const { x, y } = n.drawingCoord!
  return [x, y, x + n.drawing!.length - 1, y + n.drawing![0]!.length - 1]
}

const inside = (n: AsciiNode, sg: AsciiSubgraph): boolean => {
  const [x0, y0, x1, y1] = nodeBox(n)
  return x0 > sg.minX && x1 < sg.maxX && y0 > sg.minY && y1 < sg.maxY
}

const overlaps = (n: AsciiNode, sg: AsciiSubgraph): boolean => {
  const [x0, y0, x1, y1] = nodeBox(n)
  return x1 >= sg.minX && x0 <= sg.maxX && y1 >= sg.minY && y0 <= sg.maxY
}

const sources: Record<string, string> = {
  'issue example (TD)':
    'graph TD\nX-->Sub\nW-->Y\nY-->Sub\nsubgraph Sub\nA-->B\nA-->C\nend',
  'issue example (LR)':
    'graph LR\nX-->Sub\nW-->Y\nY-->Sub\nsubgraph Sub\nA-->B\nA-->C\nend',
  'nested subgraph (TD)':
    'graph TD\nX-->Outer\nW-->Y\nY-->Inner\nsubgraph Outer\nsubgraph Inner\nA-->B\nA-->C\nend\nD\nend\nA-->D',
  'nested subgraph (LR)':
    'graph LR\nX-->Outer\nW-->Y\nY-->Inner\nsubgraph Outer\nsubgraph Inner\nA-->B\nA-->C\nend\nD\nend\nA-->D',
}

describe('#1252: a frame contains exactly its members', () => {
  for (const [name, src] of Object.entries(sources)) {
    it(name, () => {
      const graph = layout(src)
      for (const sg of graph.subgraphs) {
        const own = members(sg)
        expect(own.length).toBeGreaterThan(0)
        for (const n of own) {
          expect(inside(n, sg), `${n.name} inside ${sg.name}`).toBe(true)
        }
        for (const n of graph.nodes) {
          if (own.includes(n)) continue
          expect(overlaps(n, sg), `${n.name} outside ${sg.name}`).toBe(false)
        }
      }
    })
  }
})

describe('#1254: edge labels and subgraph titles', () => {
  const mutual = (dir: string): string =>
    `graph ${dir}\nsubgraph One\n  A\nend\nsubgraph Two\n  B\nend\nA -->|x| B\nB -->|y| A`

  for (const dir of ['TD', 'LR']) {
    for (const useAscii of [false, true]) {
      it(`a labelled mutual pair keeps both titles whole (${dir}, ${useAscii ? 'ascii' : 'unicode'})`, () => {
        const out = renderMermaidASCII(mutual(dir), {
          useAscii,
          colorMode: 'none',
        })
        expect(out).toContain('One')
        expect(out).toContain('Two')
        expect(out).toContain('x')
        expect(out).toContain('y')
        expect(out).not.toContain('Txo')
      })
    }
  }

  it('the label moves off the title row rather than disappearing', () => {
    const lines = renderMermaidASCII(mutual('TD'), {
      colorMode: 'none',
    }).split('\n')
    const title = lines.findIndex((l) => l.includes('Two'))
    expect(lines[title]).not.toMatch(/[xy]/)
    expect(lines.join('\n')).toMatch(/x/)
  })

  const lrTitles = (dir: string): string =>
    `graph ${dir}\nsubgraph L1[Layer One]\n  A\nend\nsubgraph L2[Layer Two]\n  C\nend\nsubgraph L3[Layer Three]\n  D\nend\nA --> C\nC --> D`

  for (const dir of ['LR', 'TD']) {
    it(`a title wider than its node column widens the frame (${dir})`, () => {
      const out = renderMermaidASCII(lrTitles(dir), { colorMode: 'none' })
      for (const title of ['Layer One', 'Layer Two', 'Layer Three']) {
        expect(out).toContain(title)
      }
      // each title is flanked by its frame's walls, unclipped
      expect(out).toMatch(/│Layer One│/)
    })
  }

  it('side-by-side frames with long titles keep their titles whole (TD)', () => {
    const src =
      'graph TD\nsubgraph L1[Layer One]\n  A\nend\nsubgraph L2[Layer Two]\n  C\nend\nR --> A\nR --> C'
    const out = renderMermaidASCII(src, { colorMode: 'none' })
    expect(out).toContain('Layer One')
    expect(out).toContain('Layer Two')
  })
})
