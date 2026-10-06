/**
 * A label must read as belonging to its own edge: its text is on, or one blank
 * cell beside, that edge's drawn stroke, and no other edge's stroke is closer.
 * The #1351 port offsets moved a stroke without moving its label line to the
 * same row when the label sat on a corner shared by two shifted runs, leaving
 * `ab` between two strokes with neither claiming it.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { convertToAsciiGraph } from '../converter.ts'
import { createMapping } from '../grid.ts'
import { edgeLabelPlacement, strokeShift } from '../draw-arrows.ts'
import { pathToDrawing } from '../port-offsets.ts'
import type { AsciiEdge, AsciiGraph } from '../types.ts'

function layout(source: string): AsciiGraph {
  const graph = convertToAsciiGraph(parseMermaid(source), {
    useAscii: false,
    paddingX: 5,
    paddingY: 5,
    boxBorderPadding: 1,
    graphDirection: 'TD',
  })
  createMapping(graph)
  return graph
}

/** Every cell of an axis-aligned drawn polyline. */
function strokeCells(g: AsciiGraph, e: AsciiEdge): { x: number; y: number }[] {
  // The same polyline drawArrow draws: port offsets, or the #1284 pair shift.
  const dx = strokeShift(g, e)
  const pts = pathToDrawing(g, e).map((p) => ({ x: p.x + dx, y: p.y }))
  const cells: { x: number; y: number }[] = pts.length ? [pts[0]!] : []
  for (let i = 1; i < pts.length; i++) {
    let { x, y } = pts[i - 1]!
    const to = pts[i]!
    while (x !== to.x || y !== to.y) {
      if (x !== to.x) x += Math.sign(to.x - x)
      else y += Math.sign(to.y - y)
      cells.push({ x, y })
    }
  }
  return cells
}

/**
 * Smallest gap, in blank cells, between a label's text and a stroke: -1 when
 * the text sits on the stroke, 0 when adjacent, 1 with one blank cell between.
 */
function gap(
  label: { x: number; y: number; text: string },
  cells: { x: number; y: number }[],
): number {
  let best = Infinity
  for (const c of cells) {
    const dy = Math.abs(c.y - label.y)
    const dx =
      c.x < label.x
        ? label.x - c.x
        : c.x >= label.x + label.text.length
          ? c.x - (label.x + label.text.length - 1)
          : 0
    best = Math.min(best, Math.max(dx, dy) - 1)
  }
  return best
}

const DIAGRAMS: Record<string, string> = {
  'dense reciprocal': `graph TD
A -->|x| B
B -->|long label| A
A -->|long label| C
C -->|ab| A
B -->|mid| D
A -->|ab| D
D -->|x| A`,
  'single bend pair': `graph TD
A -->|go| C
C -->|back| A
A --> B
B --> C`,
  'straight pair': `graph TD
A -->|down| B
B -->|up| A`,
}

describe('ASCII label attribution', () => {
  for (const [name, source] of Object.entries(DIAGRAMS)) {
    it(`puts every label on or beside its own stroke: ${name}`, () => {
      const g = layout(source)
      for (const e of g.edges) {
        for (const label of edgeLabelPlacement(g, e) ?? []) {
          const own = gap(label, strokeCells(g, e))
          expect(
            own,
            `${e.from.name}->${e.to.name} "${label.text}"`,
          ).toBeLessThanOrEqual(1)
          for (const other of g.edges) {
            if (other === e) continue
            const theirs = gap(label, strokeCells(g, other))
            // Never closer to another edge's stroke than to its own. A tie is
            // allowed where no row of a short stroke can do better.
            expect(
              theirs,
              `"${label.text}" of ${e.from.name}->${e.to.name} vs ${other.from.name}->${other.to.name}`,
            ).toBeGreaterThanOrEqual(own)
          }
        }
      }
    })
  }

  it("puts C --> A's label on its own stroke, not on the row between two", () => {
    // The #1351 port offsets drew C --> A on the row below A --> C but left its
    // label on the row between them, touching both strokes and on neither.
    const g = layout(DIAGRAMS['dense reciprocal']!)
    const ca = g.edges.find((e) => e.from.name === 'C' && e.to.name === 'A')!
    const [label] = edgeLabelPlacement(g, ca)!
    expect(gap(label!, strokeCells(g, ca))).toBe(-1)
  })
})
