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
// few pixels. Horizontal ones depend on text widths, which this package sums
// from Arial advances (Mermaid measures them in a browser), and relationship
// ends follow each shape's own outline, as Mermaid's do.
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
const X = 2
const LINE = 3
// Relationships whose end this package cannot place within LINE, with the
// reason. Each is a limit of the shape outline, not of the text widths.
const WIDER_LINE = 9
const WIDER: Record<string, number[]> = {
  // A line that skims along the top of a person's body, where the pill meets
  // the head: 0.25px of height moves where it crosses by about 8px.
  'v02-person-targets': [3],
}
const LABEL = 10
// Deliberate difference (#1209): Mermaid merges two relationships with the
// same from/to (the later one wins, one line drawn). This package draws both,
// so a relationship the author wrote is never dropped. Each entry is a case
// where Mermaid drew `n` lines for a source with `n + 1` relationships.
const DUPLICATE_PAIRS = new Set(['v07-dynamic'])

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

      // Mermaid merges duplicate pairs and this package draws both (see
      // DUPLICATE_PAIRS), so the lines only line up when the counts agree.
      // A count mismatch is only allowed for a listed case, and there it must
      // be exactly the duplicate that is drawn extra.
      if (DUPLICATE_PAIRS.has(ref.name)) {
        expect(d.relationships.length, 'both duplicate lines drawn').toBe(
          ref.relationships.length + 1,
        )
        const pairs = d.relationships.map((r) => `${r.from}>${r.to}`)
        expect(
          new Set(pairs).size,
          'a pair is drawn twice, as written',
        ).toBeLessThan(pairs.length)
        return
      }
      expect(d.relationships.length, 'relationship count').toBe(
        ref.relationships.length,
      )
      d.relationships.forEach((rel, i) => {
        const r = ref.relationships[i]!
        const [s, e] = rel.points
        const got = [s!.x, s!.y, e!.x, e!.y]
        const limit = WIDER[ref.name]?.includes(i + 1) ? WIDER_LINE : LINE
        got.forEach((v, k) => {
          expect(
            Math.abs(v - r.line[k]!),
            `relationship ${i + 1} line[${k}]`,
          ).toBeLessThan(limit)
        })
        if (r.label && rel.labelPosition) {
          // Mermaid's label can sit on a shape; this package slides it along
          // the chord to clear it (#1290). That is the one allowed difference:
          // the label may move along the line but not off it.
          const dx = e!.x - s!.x
          const dy = e!.y - s!.y
          const len = Math.hypot(dx, dy)
          const across = (p: { x: number; y: number }): number =>
            ((p.x - s!.x) * dy - (p.y - s!.y) * dx) / len
          const ref0 = { x: r.label[0], y: r.label[1] }
          const moved =
            Math.abs(rel.labelPosition.x - ref0.x) >= LABEL ||
            Math.abs(rel.labelPosition.y - ref0.y) >= LABEL
          if (moved) {
            expect(
              Math.abs(across(rel.labelPosition) - across(ref0)),
              `relationship ${i + 1} label is off the chord`,
            ).toBeLessThan(LABEL)
          }
        }
      })
    })
  }
})
