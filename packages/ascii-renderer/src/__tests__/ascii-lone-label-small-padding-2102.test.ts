/**
 * #2102: a lone labelled vertical edge keeps its label off the node borders at
 * a small `paddingY`, and draws it ON the stroke as Mermaid does (not beside
 * it). The gap grows to hold the label rows, a plain stroke cell above, and a
 * plain stroke cell plus the arrowhead below (goldens: testdata/*\/label_short_gap_*_2102.txt). The SVG
 * renderer has no `paddingY` and is untouched.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const GRAPHS = {
  lone: { src: 'graph TD\nA -->|push = build| B', words: ['push = build'] },
  twoLine: { src: 'graph TD\nA -->|"one<br/>two"| B', words: ['one', 'two'] },
}

describe('label off the borders at small paddingY (#2102)', () => {
  for (const [name, { src, words }] of Object.entries(GRAPHS)) {
    for (const useAscii of [false, true]) {
      for (const paddingY of [1, 2, 3, 4, 5]) {
        it(`${name} ${useAscii ? 'ascii' : 'unicode'} paddingY=${paddingY}`, () => {
          const lines = renderMermaidASCII(src, {
            colorMode: 'none',
            useAscii,
            paddingY,
          }).split('\n')
          const border = (l: string) => /^[+┌└][-─]+[+┬┐┘-]/.test(l)
          for (const w of words) {
            const row = lines.findIndex((l) => l.includes(w))
            expect(row, `${w} drawn`).toBeGreaterThan(0)
            expect(border(lines[row]!), `${w} not on a border`).toBe(false)
          }
          // Both boxes keep a whole border, the arrowhead survives.
          expect(lines.filter((l) => /^[+┌└]/.test(l))).toHaveLength(4)
          expect(lines.join('\n')).toMatch(useAscii ? /v/ : /▼/)
          // The stroke (or the border junction it leaves) sits above the label.
          const first = lines.findIndex((l) => l.includes(words[0]!))
          expect(lines[first - 1]).toMatch(/[|│+┬]/)
          // Inline: the label is centred on the stroke column, and the stroke
          // carries on in that column on the rows just above and below it.
          const col =
            lines.findIndex((l) => /^[+└]/.test(l)) >= 0
              ? lines[first - 1]!.search(/[|│+┬]/)
              : -1
          const last = first + words.length - 1
          for (let r = first; r <= last; r++) {
            const l = lines[r]!
            const w = words[r - first]!
            const at = l.indexOf(w)
            expect(col, `${w} covers the stroke column`).toBeGreaterThanOrEqual(
              at,
            )
            expect(col).toBeLessThan(at + w.length)
          }
          expect(lines[last + 1]![col]).toMatch(/[|│]/)
        })
      }
    }
  }
})
