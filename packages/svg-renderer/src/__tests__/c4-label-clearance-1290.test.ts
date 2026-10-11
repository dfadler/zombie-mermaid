import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import { c4RelLabelLines, parseC4Diagram } from '@zombie-mermaid/mermaid-parser'
import { layoutC4DiagramSync } from '../c4/layout.ts'
import { C4, c4TextWidth } from '../c4/metrics.ts'

// Mermaid starts a relationship label at the chord's midpoint, which can land
// it on a shape. The label slides along its line to clear every shape (#1290).
const layout = (src: string) =>
  layoutC4DiagramSync(parseC4Diagram(splitStatements(src)))

// The C4 Container sample: `Reads/writes [SQL]` and `Publishes [AMQP]` both
// used to sit on the Database cylinder.
const container = `C4Container
  Person(user, "User")
  System_Boundary(sys, "Shop") {
    Container(web, "Web App", "React", "Storefront")
    Container(api, "API", "Node.js", "Business logic")
    ContainerDb(db, "Database", "PostgreSQL", "Orders")
    ContainerQueue(q, "Events", "Kafka")
  }
  System_Ext(pay, "Payments")
  Rel(user, web, "Browses")
  Rel(web, api, "Calls", "JSON/HTTPS")
  Rel(api, db, "Reads/writes", "SQL")
  BiRel(api, q, "Publishes", "AMQP")
  Rel(api, pay, "Charges cards")`

function labelRects(d: ReturnType<typeof layout>) {
  return d.relationships.flatMap((rel) => {
    if (!rel.labelPosition) return []
    const lines = c4RelLabelLines(rel)
    return lines.map((line, i) => {
      const isTech = rel.technology !== undefined && i === lines.length - 1
      const w = c4TextWidth(line, C4.messageSize, 400)
      const cx =
        isTech && rel.technologyX !== undefined
          ? rel.technologyX
          : rel.labelPosition!.x
      const cy = rel.labelPosition!.y + (i === 0 ? 0 : C4.messageSize + 5)
      return {
        rel: `${rel.from}->${rel.to}`,
        x0: cx - w / 2,
        x1: cx + w / 2,
        y0: cy - C4.messageSize / 2,
        y1: cy + C4.messageSize / 2,
      }
    })
  })
}

function overlapping(d: ReturnType<typeof layout>): string[] {
  const hits: string[] = []
  for (const r of labelRects(d)) {
    for (const e of d.elements) {
      if (
        r.x0 < e.x + e.width &&
        r.x1 > e.x &&
        r.y0 < e.y + e.height &&
        r.y1 > e.y
      ) {
        hits.push(`${r.rel} label over ${e.alias}`)
      }
    }
  }
  return hits
}

describe('C4 relationship labels clear the shapes (#1290)', () => {
  it('keeps every label in the Container sample off every shape', () => {
    expect(overlapping(layout(container))).toEqual([])
  })

  it('keeps a label on its own line, only sliding along it', () => {
    const d = layout(container)
    const rel = d.relationships.find((r) => r.to === 'db')!
    const [s, e] = rel.points
    const dx = e!.x - s!.x
    const dy = e!.y - s!.y
    const t = rel.labelPosition!
    // Same distance from the chord as an unmoved label: Mermaid's label is
    // half its own width to the right of the midpoint, never further off.
    const across = Math.abs(
      ((t.x - s!.x) * dy - (t.y - s!.y) * dx) / Math.hypot(dx, dy),
    )
    expect(across).toBeLessThan(40)
  })

  it('leaves a label that already clears every shape where Mermaid puts it', () => {
    const d = layout(`C4Context
  System(a, "A")
  System(b, "B")
  Rel(a, b, "Uses")`)
    const rel = d.relationships[0]!
    const [s, e] = rel.points
    const mid = (s!.x + e!.x) / 2
    const width = c4TextWidth('Uses', C4.messageSize, 400)
    expect(rel.labelPosition!.x).toBeCloseTo(mid + width / 2, 5)
  })

  it('does not let two labels in one gap sit on each other', () => {
    const rects = labelRects(layout(container))
    for (const [i, a] of rects.entries()) {
      for (const b of rects.slice(i + 1)) {
        if (a.rel === b.rel) continue
        const apart =
          a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0
        expect(apart, `${a.rel} vs ${b.rel}`).toBe(true)
      }
    }
  })
})
