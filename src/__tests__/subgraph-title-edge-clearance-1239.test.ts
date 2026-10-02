/**
 * #1239: an edge from outside a subgraph to a node inside it was routed over
 * the top of the box, straight onto the subgraph's title text. Edges now clear
 * the text: shifted sideways when possible, otherwise detoured in through a
 * side wall below the title bar.
 */
import { describe, it, expect } from 'vitest'
import { measureMultilineText } from '@zombie-mermaid/core'
import { parseMermaid } from '../index.ts'
import { layoutGraphSync } from '@zombie-mermaid/svg-renderer'
import type {
  PositionedEdge,
  PositionedGraph,
  PositionedGroup,
  PositionedNode,
  Point,
} from '@zombie-mermaid/core'
import { routeEdgesAroundGroupTitles } from '../../packages/svg-renderer/src/layout-engine/title-avoidance.ts'

const TITLE_HEIGHT = 28
// The renderer draws the title at group.x + 12, 12px, weight 600.
const textBox = (g: PositionedGroup) => ({
  left: g.x + 12,
  right: g.x + 12 + measureMultilineText(g.label, 12, 600).width,
})

/** True when the axis-aligned segment a-b passes over the group's title text. */
function segmentHitsTitle(a: Point, b: Point, g: PositionedGroup): boolean {
  const t = textBox(g)
  return (
    Math.max(a.x, b.x) > t.left &&
    Math.min(a.x, b.x) < t.right &&
    Math.max(a.y, b.y) > g.y &&
    Math.min(a.y, b.y) < g.y + TITLE_HEIGHT
  )
}

function titleHits(p: PositionedGraph): string[] {
  const hits: string[] = []
  const groups: PositionedGroup[] = []
  const walk = (gs: PositionedGroup[]) =>
    gs.forEach((g) => {
      groups.push(g)
      walk(g.children)
    })
  walk(p.groups)
  for (const e of p.edges) {
    for (const g of groups) {
      for (let i = 0; i + 1 < e.points.length; i++) {
        if (segmentHitsTitle(e.points[i]!, e.points[i + 1]!, g)) {
          hits.push(`${e.source}->${e.target} through "${g.label}"`)
        }
      }
    }
  }
  return hits
}

const CI_CD = `graph TD
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

describe('subgraph title clearance (#1239)', () => {
  it('routes no edge of the CI/CD sample over the "CI Pipeline" title', () => {
    const p = layoutGraphSync(parseMermaid(CI_CD))
    expect(titleHits(p)).toEqual([])
    // The moved edge still ends on its target.
    const e = p.edges.find((x) => x.source === 'F' && x.target === 'D')!
    const d = p.nodes.find((n) => n.id === 'D')!
    const last = e.points[e.points.length - 1]!
    expect(last.x).toBeGreaterThanOrEqual(d.x - 1)
    expect(last.x).toBeLessThanOrEqual(d.x + d.width + 1)
  })

  it('leaves edges that already clear a title alone (Subgraphs sample)', () => {
    const src = `graph TD
  subgraph Frontend
    A[React App] --> B[State Manager]
  end
  subgraph Backend
    C[API Server] --> D[Database]
  end
  B --> C`
    const p = layoutGraphSync(parseMermaid(src))
    const e = p.edges.find((x) => x.source === 'B' && x.target === 'C')!
    // Straight drop plus one jog; no detour around the side of the box.
    expect(e.points.length).toBeLessThanOrEqual(4)
    const backend = p.groups.find((g) => g.label === 'Backend')!
    expect(e.points.every((pt) => pt.x > backend.x)).toBe(true)
  })

  describe('routeEdgesAroundGroupTitles', () => {
    const group: PositionedGroup = {
      id: 'g',
      label: 'Group title',
      x: 100,
      y: 100,
      width: 300,
      height: 200,
      children: [],
    }
    const target: PositionedNode = {
      id: 'b',
      label: 'B',
      shape: 'rectangle',
      x: 110,
      y: 160,
      width: 250,
      height: 40,
    }
    const edge = (points: Point[]): PositionedEdge => ({
      source: 'a',
      target: 'b',
      style: 'solid',
      hasArrowStart: false,
      hasArrowEnd: true,
      points,
    })
    const down = (x: number): Point[] => [
      { x: 20, y: 60 },
      { x, y: 60 },
      { x, y: 160 },
    ]

    it('shifts the crossing right of the title text when the target allows', () => {
      const e = edge(down(120))
      routeEdgesAroundGroupTitles([e], [group], [target])
      const t = textBox(group)
      expect(e.points).toHaveLength(3)
      expect(e.points[2]!.x).toBeGreaterThan(t.right)
      expect(e.points[2]!.x).toBeLessThan(target.x + target.width)
      expect(e.points[1]!.x).toBe(e.points[2]!.x)
      expect(e.points[2]!.y).toBe(160)
    })

    it('detours around the side when the target is too narrow to shift onto', () => {
      const narrow = { ...target, width: 30 }
      const e = edge(down(120))
      routeEdgesAroundGroupTitles([e], [group], [narrow])
      expect(e.points.some((p) => p.x < group.x)).toBe(true)
      expect(e.points[e.points.length - 1]).toEqual({ x: 120, y: 160 })
      for (let i = 0; i + 1 < e.points.length; i++) {
        expect(segmentHitsTitle(e.points[i]!, e.points[i + 1]!, group)).toBe(
          false,
        )
      }
    })

    it('leaves a segment right of the title text untouched', () => {
      const pts = down(300)
      const e = edge(pts.map((p) => ({ ...p })))
      routeEdgesAroundGroupTitles([e], [group], [target])
      expect(e.points).toEqual(pts)
    })
  })
})
