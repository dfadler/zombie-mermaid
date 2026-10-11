/**
 * Regression tests for #1222 (follow-up to #1197) and #1248: a forward edge
 * entering a titled subgraph frame from above must stay continuous through
 * the title row, and the title must stay whole. The title used to be drawn on
 * top of the edge column (titles are centred, the entry column usually is
 * too), so the edge showed a junction tick on the border, vanished behind the
 * title, and resumed below.
 *
 * Titles now slide aside, or the frame is widened (on the right) until the
 * title fits beside the stroke. #1222 split the title on a space instead
 * ("Layer│Three"); #1248 replaced that, since a line through the middle of a
 * title reads as a rendering artifact.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

interface Case {
  name: string
  src: string
  /** The whole title, expected unsplit on a single row. */
  title: string
}

const chain = (second: string, third: string): string =>
  `graph TD\nsubgraph L1[One]\nA\nend\nsubgraph L2[${second}]\nC\nend\nsubgraph L3[${third}]\nE\nend\nA --> C\nC --> E\nE --> A`

const cases: Case[] = [
  {
    name: 'a title wider than either side of the stroke widens the frame',
    src: chain('x', 'Layer Three'),
    title: 'Layer Three',
  },
  {
    name: 'two such titles in one chain (#1248 repro)',
    src: chain('Layer Two', 'Layer Three'),
    title: 'Layer Two',
  },
  {
    name: 'short title slides aside',
    src: 'graph TD\nsubgraph O[Outer]\nsubgraph I1[In1]\nA\nend\nsubgraph I2[In2]\nB\nend\nend\nsubgraph P[Pee]\nC\nend\nA --> B\nB --> C\nC --> A',
    title: 'In2',
  },
  {
    name: 'architecture-beta group title stays whole',
    src: 'architecture-beta\ngroup g1(cloud)[Group One]\ngroup g2(cloud)[Group Two]\ngroup g3(cloud)[Group Three]\nservice a(server)[A] in g1\nservice b(server)[B] in g2\nservice c(server)[C] in g3\na:B --> T:b\nb:B --> T:c',
    title: 'Group Three',
  },
]

const STROKES = new Set(['│', '|'])
const ARROWS = new Set(['▼', 'v'])

describe('#1222/#1248: forward edge stays continuous through a frame title row', () => {
  for (const c of cases) {
    for (const useAscii of [false, true]) {
      it(`${c.name} (${useAscii ? 'ascii' : 'unicode'})`, () => {
        const lines = renderMermaidASCII(c.src, {
          useAscii,
          colorMode: 'none',
        }).split('\n')
        // the whole title is on one row: nothing splits it
        const title = lines.findIndex((l) => l.includes(c.title))
        expect(title, 'title row present and unsplit').toBeGreaterThan(0)
        const first = lines[title]!.indexOf(c.title)
        const last = first + c.title.length - 1
        // the stroke crosses the border row inside the frame, beside the title
        const border = lines[title - 1]!
        const cols = [...border]
          .map((ch, i) => (ch === '┼' || ch === '|' ? i : -1))
          .filter((i) => i >= 0 && (i < first || i > last))
        expect(cols.length, 'edge crosses the frame border').toBeGreaterThan(0)
        // (ASCII frame walls are `|` too, so more than one column can
        // qualify: the edge is the one that runs unbroken to an arrowhead.)
        const continuous = cols.some((edgeCol) => {
          if (!STROKES.has(lines[title]![edgeCol]!)) return false
          for (let j = title + 1; j < title + 8; j++) {
            const ch = lines[j]![edgeCol]!
            if (ARROWS.has(ch)) return true
            if (!STROKES.has(ch)) return false
          }
          return false
        })
        expect(continuous, 'edge unbroken from border to arrow').toBe(true)
      })
    }
  }

  it('never splits a title on a space, even when its centre space is the stroke column', () => {
    const out = renderMermaidASCII(chain('x', 'Layer Three'), {
      colorMode: 'none',
    })
    expect(out).not.toMatch(/Layer│Three/)
    expect(out).toContain('Layer Three')
  })

  it('slides a short title aside, leaving one clear column before the stroke', () => {
    const src =
      'graph TD\nsubgraph F[Frontend]\nA[React App] --> B[State Manager]\nend\nsubgraph K[Backend]\nC[API Server]\nend\nB --> C'
    const out = renderMermaidASCII(src, { colorMode: 'none' })
    expect(out).toContain('│ Backend │')
  })

  it('does not resize a frame that has no collision', () => {
    const src =
      'graph TD\nsubgraph F[Frontend]\nA[React App] --> B[State Manager]\nend\nsubgraph K[Backend]\nC[API Server]\nend\nB --> C'
    const out = renderMermaidASCII(src, { colorMode: 'none' })
    expect(out.split('\n')[0]).toBe('┌───────────────────┐')
  })

  it('leaves LR frames alone (edges enter on the node row)', () => {
    const src = chain('Layer Two', 'Layer Three').replace('TD', 'LR')
    const out = renderMermaidASCII(src, { colorMode: 'none' })
    expect(out).not.toMatch(/Layer│/)
  })
})
