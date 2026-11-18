/**
 * `layoutEdgeLabelFontSize` boxes edge labels the way mermaid@12.3.0 does
 * (16px) without changing the drawn text, and with it the 70px edge spacing
 * that stood in for those boxes is not needed. Numbers are from mermaid@12.3.0
 * (headless, `scripts/lib/oracle-layout.ts`) on `Five Cluster Exit Siblings`:
 * T sits 196px below `a` (TD), 25px left of Start, and U 192px right of T.
 */
import { describe, it, expect } from 'vitest'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'
import { layoutFlowchartSync } from '@zombie-mermaid/svg-renderer'

const SRC = `flowchart TD
  subgraph S [Cluster]
    a
  end
  Start --> S
  S -->|1| T
  S -->|2| T
  S -->|3| T
  S -->|4| T
  S -->|5| T
  S -->|other| U`

const centre = (n: {
  x: number
  y: number
  width: number
  height: number
}) => ({
  x: n.x + n.width / 2,
  y: n.y + n.height / 2,
})

function gaps(options: { layoutEdgeLabelFontSize?: number }) {
  const p = layoutFlowchartSync(parseMermaid(SRC), {
    fontSizes: { nodeLabel: 16 },
    ...options,
  })
  const at = (id: string) => centre(p.nodes.find((n) => n.id === id)!)
  return {
    down: at('T').y - at('a').y,
    startToT: at('T').x - at('Start').x,
    tToU: at('U').x - at('T').x,
  }
}

describe('layoutEdgeLabelFontSize', () => {
  it('lays Five Cluster Exit Siblings out within a few px of mermaid@12.3.0', () => {
    const g = gaps({ layoutEdgeLabelFontSize: 16 })
    expect(Math.abs(g.down - 196)).toBeLessThan(6)
    expect(Math.abs(g.startToT - -25)).toBeLessThan(6)
    expect(Math.abs(g.tToU - 192)).toBeLessThan(6)
  })

  it('leaves the default layout alone', () => {
    const g = gaps({})
    expect(g.tToU).toBeGreaterThan(250)
  })
})
