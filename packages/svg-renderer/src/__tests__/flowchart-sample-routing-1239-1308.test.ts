/**
 * #1239 / #1308 acceptance bar, pinned on the two samples the issues name
 * (CI/CD and git branching): no edge runs through a subgraph title band, and
 * edges leaving (or returning to) one node never share a run at its port.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { layoutFlowchartSync } from '@zombie-mermaid/svg-renderer'

const CICD = `graph TD
  subgraph ci [CI Pipeline]
    A[Push Code] --> B{Tests Pass?}
    B -->|Yes| C[Build Image]
    B -->|No| D[Fix & Retry]
    D -.-> A
  end
  C --> E([Deploy Staging])
  E --> F{QA Approved?}
  F -->|Yes| G((Production))
  F -->|No| D`

const BRANCHING = `graph LR
  A[main] --> B[develop]
  B --> C[feature/auth]
  B --> D[feature/ui]
  C --> E{PR Review}
  D --> E
  E -->|approved| B
  B --> F[release/1.0]
  F --> G{Tests?}
  G -->|pass| A
  G -->|fail| F`

/** Height of the title strip at the top of a subgraph box. */
const TITLE_BAND = 28

describe('sample routing acceptance bar (#1239, #1308)', () => {
  it('CI/CD: no edge segment passes through the CI Pipeline title band', () => {
    const layout = layoutFlowchartSync(parseMermaid(CICD))
    const group = layout.groups.find((g) => g.id === 'ci')
    expect(group).toBeDefined()
    const { x, y, width } = group!
    for (const e of layout.edges) {
      for (let i = 0; i + 1 < e.points.length; i++) {
        const p = e.points[i]!
        const q = e.points[i + 1]!
        const hitsBand =
          Math.max(p.y, q.y) > y &&
          Math.min(p.y, q.y) < y + TITLE_BAND &&
          Math.max(p.x, q.x) > x &&
          Math.min(p.x, q.x) < x + width
        expect(hitsBand, `${e.source}->${e.target} segment ${i}`).toBe(false)
      }
    }
  })

  it('git branching: every edge touching develop meets its right side at its own y', () => {
    const edges = layoutFlowchartSync(parseMermaid(BRANCHING)).edges
    const ys = edges
      .filter((e) => e.source === 'B' && e.target !== 'B')
      .map((e) => e.points[0]!.y)
    ys.push(
      ...edges
        .filter((e) => e.target === 'B' && e.source === 'E')
        .map((e) => e.points[e.points.length - 1]!.y),
    )
    expect(ys).toHaveLength(4)
    // At least a few px apart: touching or one-px-offset runs read as one trunk.
    const sorted = [...ys].sort((a, b) => a - b)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThan(4)
    }
  })
})
