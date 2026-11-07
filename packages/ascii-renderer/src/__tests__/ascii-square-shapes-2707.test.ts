/**
 * Diamond, circle and double circle are square in mermaid 12.3.0 at every label
 * size (#2707): the SVG renderer draws them 1:1, and the ASCII renderer grows
 * rows with the width (a cell is about twice as tall as wide) instead of keeping
 * a box's row count.
 */
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidSVG } from '../../../../src/index.ts'

const SHAPES = {
  diamond: (l: string) => `D{${l}}`,
  circle: (l: string) => `D((${l}))`,
  doublecircle: (l: string) => `D(((${l})))`,
} as const
const LABELS = ['Hi', 'A longer label', 'A much longer label for the node here']

/** Width and height of the node's drawn rows (the only node in the diagram). */
function extent(text: string): { cols: number; rows: number } {
  const lines = text.split('\n').filter((l) => l.trim() !== '')
  return {
    cols: Math.max(...lines.map((l) => l.trimEnd().length)),
    rows: lines.length,
  }
}

describe('square shapes in ASCII (#2707)', () => {
  for (const [name, def] of Object.entries(SHAPES)) {
    for (const label of LABELS) {
      for (const useAscii of [false, true]) {
        it(`${name} "${label}" (${useAscii ? 'ascii' : 'unicode'}) has about cols / 2 rows`, () => {
          const out = renderMermaidASCII(`flowchart TD\n  ${def(label)}`, {
            useAscii,
          })
          const { cols, rows } = extent(out)
          // At least a box's 5 rows (7 for the double circle); otherwise square within one row of cols / 2.
          expect(rows).toBeGreaterThanOrEqual(5)
          expect(rows).toBeGreaterThanOrEqual(Math.ceil(cols / 2) - 1)
          expect(rows).toBeLessThanOrEqual(Math.max(7, Math.ceil(cols / 2)))
          expect(rows % 2).toBe(1)
        })
      }
    }
  }

  it('draws a long-label diamond as a tall rhombus (unicode)', () => {
    expect(
      renderMermaidASCII('flowchart TD\n  D{Is it working today}', {}),
    ).toBe(
      [
        '           ╱╲           ',
        '         ╱    ╲         ',
        '       ╱        ╲       ',
        '    ╱              ╲    ',
        '  ╱                  ╲  ',
        '< Is it working today  >',
        '  ╲                  ╱  ',
        '    ╲              ╱    ',
        '       ╲        ╱       ',
        '         ╲    ╱         ',
        '           ╲╱           ',
      ].join('\n'),
    )
  })
})

describe('square shapes in SVG (#2707)', () => {
  const box = (svg: string, tag: 'polygon' | 'circle'): [number, number] => {
    if (tag === 'circle') {
      const r = [...svg.matchAll(/<circle[^>]* r="([\d.]+)"/g)].map(
        (m) => +m[1]!,
      )
      return [2 * Math.max(...r), 2 * Math.max(...r)]
    }
    const pts = svg
      .match(/<polygon points="([^"]+)" fill="var\(--_node-fill\)"/)![1]!
      .split(' ')
      .map((p) => p.split(',').map(Number))
    const xs = pts.map((p) => p[0]!)
    const ys = pts.map((p) => p[1]!)
    return [
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    ]
  }
  for (const label of LABELS) {
    it(`diamond "${label}"`, () => {
      const [w, h] = box(
        renderMermaidSVG(`flowchart TD\n  ${SHAPES.diamond(label)}`),
        'polygon',
      )
      expect(w).toBeCloseTo(h, 1)
    })
    it(`circle and double circle "${label}"`, () => {
      for (const s of ['circle', 'doublecircle'] as const) {
        const svg = renderMermaidSVG(`flowchart TD\n  ${SHAPES[s](label)}`)
        expect(svg).toMatch(/<circle /)
        expect(svg).not.toMatch(/<ellipse /)
      }
    })
  }
})
