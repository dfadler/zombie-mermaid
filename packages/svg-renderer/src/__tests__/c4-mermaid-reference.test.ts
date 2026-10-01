import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { splitStatements } from '@zombie-mermaid/core'
import { parseC4Diagram } from '@zombie-mermaid/mermaid-parser'
import { layoutC4DiagramSync } from '../c4/layout.ts'

// Each case is a C4 source rendered by real Mermaid 11.17.2 (headless Chrome,
// screen width 1440), with the numbers read back from its SVG: the diagram
// size, the centre of every shape, and each relationship's line and label.
// The sources vary on purpose (shapes of every kind, wrapped names and
// descriptions, boundaries nested and side by side, relationships in every
// direction), so a constant tuned to one sample cannot satisfy all of them.
//
// Vertical numbers depend only on heights and gaps, so they must agree to a
// few pixels. Horizontal ones depend on text widths, which this package
// estimates (Mermaid measures them in a browser), and relationship ends depend
// on each shape's own outline, so those get a wider allowance.
interface Reference {
  name: string
  source: string
  width: number
  height: number
  elements: Record<string, [number, number]>
  relationships: { line: number[]; label?: [number, number] }[]
}

const cases: Reference[] = JSON.parse(
  readFileSync(
    new URL('./fixtures/c4-mermaid-reference.json', import.meta.url),
    'utf8',
  ),
)

const Y = 3
const X = 11
const LINE = 16
const LABEL = 10

describe('C4 SVG layout against Mermaid on varied diagrams', () => {
  it('covers a spread of diagrams', () => {
    expect(cases.length).toBeGreaterThanOrEqual(30)
  })

  for (const ref of cases) {
    it(`${ref.name} matches Mermaid`, () => {
      const d = layoutC4DiagramSync(parseC4Diagram(splitStatements(ref.source)))
      expect(Math.abs(d.height - ref.height), 'diagram height').toBeLessThan(Y)
      expect(Math.abs(d.width - ref.width), 'diagram width').toBeLessThan(X)

      for (const e of d.elements) {
        const r = ref.elements[e.alias]
        if (!r) continue
        const cx = e.x + e.width / 2
        const cy = e.y + e.height / 2
        expect(Math.abs(cx - r[0]), `${e.alias} centre x`).toBeLessThan(X)
        expect(Math.abs(cy - r[1]), `${e.alias} centre y`).toBeLessThan(Y)
      }

      // Mermaid merges two relationships between the same pair; this draws
      // both, so the lines only line up when the counts agree.
      if (ref.relationships.length !== d.relationships.length) return
      d.relationships.forEach((rel, i) => {
        const r = ref.relationships[i]!
        const [s, e] = rel.points
        const got = [s!.x, s!.y, e!.x, e!.y]
        got.forEach((v, k) => {
          expect(
            Math.abs(v - r.line[k]!),
            `relationship ${i + 1} line[${k}]`,
          ).toBeLessThan(LINE)
        })
        if (r.label && rel.labelPosition) {
          expect(
            Math.abs(rel.labelPosition.x - r.label[0]),
            `relationship ${i + 1} label x`,
          ).toBeLessThan(LABEL)
          expect(
            Math.abs(rel.labelPosition.y - r.label[1]),
            `relationship ${i + 1} label y`,
          ).toBeLessThan(LABEL)
        }
      })
    })
  }
})
