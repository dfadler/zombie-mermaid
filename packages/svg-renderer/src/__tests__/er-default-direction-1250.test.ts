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

  it('keeps declaration order within a layer and centers a shared child', () => {
    const svg = renderMermaidSVG(`erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  PRODUCT ||--o{ LINE_ITEM : includes`)
    const box = (id: string): { left: number; right: number } => {
      const m = svg.match(
        new RegExp(
          `data-id="${id}"[^>]*>\\s*<rect x="([\\d.]+)"[^>]*width="([\\d.]+)"`,
        ),
      )
      expect(m).not.toBeNull()
      const x = Number(m?.[1])
      return { left: x, right: x + Number(m?.[2]) }
    }
    const order = box('ORDER')
    const product = box('PRODUCT')
    const lineItem = box('LINE_ITEM')
    // ORDER is declared before PRODUCT, so it sits to its left.
    expect(order.left).toBeLessThan(product.left)
    // LINE_ITEM sits between its two parents, not off to one side.
    const mid = (lineItem.left + lineItem.right) / 2
    expect(mid).toBeGreaterThan(order.left)
    expect(mid).toBeLessThan(product.right)
  })
})
