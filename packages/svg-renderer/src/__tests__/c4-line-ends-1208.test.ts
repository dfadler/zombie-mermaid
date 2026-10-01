import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import { parseC4Diagram } from '@zombie-mermaid/mermaid-parser'
import { layoutC4DiagramSync } from '../c4/layout.ts'
import { c4PersonGeometry } from '../c4/metrics.ts'

// A relationship meets a cylinder, pipe or person where Mermaid's own shape
// outline puts it, not at the box around the shape (#1208). The pipe and the
// oblique person cases are checked against recorded Mermaid output in
// c4-mermaid-reference.test.ts.
const layout = (src: string) =>
  layoutC4DiagramSync(parseC4Diagram(splitStatements(src)))

describe('C4 line ends on shaped elements (#1208)', () => {
  // Row 1 holds four shapes and row 2 starts under the first, so the line from
  // `b` down to the database arrives from the upper right.
  const src = `C4Context
  System(a, "A")
  System(b, "B")
  System(c, "C")
  System(e, "E")
  SystemDb(db, "Store")
  Rel(b, db, "Reads")`

  it('ends a slanted line on the curve of the cylinder cap, below the box top', () => {
    const d = layout(src)
    const store = d.elements.find((e) => e.alias === 'db')!
    const [, end] = d.relationships[0]!.points
    // 84.4px right of the centre the cap (rx 108, ry 15.8) has dropped
    // 5.9px, so the line ends 5.9px under the top of the box, not on it.
    expect(end!.y - store.y).toBeCloseTo(5.96, 1)
  })

  it('ends a line into the bottom middle of a cylinder at the box bottom', () => {
    const d = layout(`C4Context
  SystemDb(db, "Store")
  System(b, "B")
  System(c, "C")
  System(e, "E")
  System(f, "F")
  Rel(f, db, "Reads")`)
    const store = d.elements.find((e) => e.alias === 'db')!
    const [, end] = d.relationships[0]!.points
    // Straight below the centre the ellipse is at its lowest: no lift.
    expect(end!.y - (store.y + store.height)).toBeCloseTo(0, 5)
  })

  it("keeps a wide person head at Mermaid's 56px radius cap", () => {
    expect(c4PersonGeometry(216).headRadius).toBeCloseTo(49.68, 2)
    expect(c4PersonGeometry(400).headRadius).toBe(56)
  })
})
