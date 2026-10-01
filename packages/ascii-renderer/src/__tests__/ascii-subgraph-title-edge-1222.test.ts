/**
 * Regression tests for #1222 (follow-up to #1197): a forward edge entering a
 * titled subgraph frame from above must stay continuous through the title
 * row. The title used to be drawn on top of the edge column (titles are
 * centred, the entry column usually is too), so the edge showed a junction
 * tick on the border, vanished behind the title, and resumed below.
 *
 * Titles now slide aside, or split on a space ("Layer│Three"), instead of
 * covering the stroke. When neither is possible without dropping a letter the
 * title still wins and stays intact (asserted separately).
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

interface Case {
  name: string
  src: string
  /** Title text left / right of the stroke on the title row ('' = no split). */
  left: string
  right: string
}

const chain = (second: string, third: string): string =>
  `graph TD\nsubgraph L1[One]\nA\nend\nsubgraph L2[${second}]\nC\nend\nsubgraph L3[${third}]\nE\nend\nA --> C\nC --> E\nE --> A`

const cases: Case[] = [
  {
    name: 'title splits on its centre space',
    src: chain('x', 'Layer Three'),
    left: 'Layer',
    right: 'Three',
  },
  {
    name: 'short title slides aside',
    src: 'graph TD\nsubgraph O[Outer]\nsubgraph I1[In1]\nA\nend\nsubgraph I2[In2]\nB\nend\nend\nsubgraph P[Pee]\nC\nend\nA --> B\nB --> C\nC --> A',
    left: 'In2',
    right: '',
  },
  {
    name: 'architecture-beta group title splits on its space',
    src: 'architecture-beta\ngroup g1(cloud)[Group One]\ngroup g2(cloud)[Group Two]\ngroup g3(cloud)[Group Three]\nservice a(server)[A] in g1\nservice b(server)[B] in g2\nservice c(server)[C] in g3\na:B --> T:b\nb:B --> T:c',
    left: 'Group',
    right: 'Three',
  },
]

const STROKES = new Set(['│', '|'])
const ARROWS = new Set(['▼', 'v'])

describe('#1222: forward edge stays continuous through a frame title row', () => {
  for (const c of cases) {
    for (const useAscii of [false, true]) {
      it(`${c.name} (${useAscii ? 'ascii' : 'unicode'})`, () => {
        const stroke = useAscii ? '|' : '│'
        const lines = renderMermaidASCII(c.src, {
          useAscii,
          colorMode: 'none',
        }).split('\n')
        const title = lines.findIndex((l) =>
          l.includes(`${c.left}${c.right ? stroke : ''}${c.right}`),
        )
        // the title is intact on one row, with at most the stroke inside it
        expect(title, 'title row present and not garbled').toBeGreaterThan(0)
        const edgeCol = lines[title]!.indexOf(c.left) + c.left.length
        // the border tick above, the title row, then every row down to the arrow
        expect(
          STROKES.has(lines[title - 1]![edgeCol]!) ||
            lines[title - 1]![edgeCol] === '┼',
        ).toBe(true)
        expect(STROKES.has(lines[title]![edgeCol]!)).toBe(true)
        let j = title + 1
        while (!ARROWS.has(lines[j]![edgeCol]!)) {
          expect(STROKES.has(lines[j]![edgeCol]!), `row ${j}`).toBe(true)
          j++
          expect(j - title).toBeLessThan(8)
        }
      })
    }
  }

  it('slides a short title aside, leaving one clear column before the stroke', () => {
    const src =
      'graph TD\nsubgraph F[Frontend]\nA[React App] --> B[State Manager]\nend\nsubgraph K[Backend]\nC[API Server]\nend\nB --> C'
    const out = renderMermaidASCII(src, { colorMode: 'none' })
    expect(out).toContain('│ Backend │')
  })

  it('keeps a title intact when the stroke cannot avoid a letter', () => {
    const src = chain('Layer Two', 'Layer Three')
    const out = renderMermaidASCII(src, { colorMode: 'none' })
    expect(out).toContain('│Layer Two│')
  })
})
