/**
 * #1250: an ER diagram with no `direction` statement laid out left-to-right,
 * while official Mermaid lays it out top-to-bottom. The relationship line
 * between two entities is the layout axis: vertical when stacked, horizontal
 * when side by side.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

const SOURCE = 'ORDER ||--|{ LINE_ITEM : contains'

function endpoints(svg: string): { dx: number; dy: number } {
  const points = svg.match(/class="er-relationship"[^>]*points="([^"]+)"/)?.[1]
  expect(points).toBeDefined()
  const pts = (points ?? '').split(' ').map((p) => p.split(',').map(Number))
  const first = pts[0] ?? []
  const last = pts[pts.length - 1] ?? []
  return {
    dx: Math.abs((last[0] ?? 0) - (first[0] ?? 0)),
    dy: Math.abs((last[1] ?? 0) - (first[1] ?? 0)),
  }
}

describe('ER default layout direction (#1250)', () => {
  it('stacks entities top-to-bottom when the source has no direction', () => {
    const { dx, dy } = endpoints(renderMermaidSVG(`erDiagram\n  ${SOURCE}`))
    expect(dy).toBeGreaterThan(dx)
  })

  it('still honors an explicit `direction LR` in the source', () => {
    const { dx, dy } = endpoints(
      renderMermaidSVG(`erDiagram\n  direction LR\n  ${SOURCE}`),
    )
    expect(dx).toBeGreaterThan(dy)
  })

  it('still honors the direction render option', () => {
    const { dx, dy } = endpoints(
      renderMermaidSVG(`erDiagram\n  ${SOURCE}`, { direction: 'LR' }),
    )
    expect(dx).toBeGreaterThan(dy)
  })
})
