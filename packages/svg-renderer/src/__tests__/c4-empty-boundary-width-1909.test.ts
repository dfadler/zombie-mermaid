import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import { parseC4Diagram } from '@zombie-mermaid/mermaid-parser'
import { layoutC4DiagramSync } from '../c4/layout.ts'

// Mermaid itself rejects an empty `Deployment_Node` (parse error), so there is
// no reference render; the frame just must not run past the SVG edge (#1909).
describe('C4 empty boundary width (#1909)', () => {
  it('keeps an empty boundary frame inside the diagram width', () => {
    const d = layoutC4DiagramSync(
      parseC4Diagram(
        splitStatements(`C4Deployment
  Deployment_Node(dc, "DC", "Ubuntu") {
    Container(app, "App", "Java")
  }
  Deployment_Node(empty, "Empty", "x")`),
      ),
    )
    const empty = d.boundaries.find((b) => b.alias === 'empty')!
    expect(empty.x + empty.width).toBeLessThanOrEqual(d.width)
  })
})
