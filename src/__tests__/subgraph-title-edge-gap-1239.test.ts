/**
 * #1239: an edge from outside a subgraph to a node inside it can run over the
 * subgraph's title text. mermaid.js draws it through the text too; here the
 * edge is not painted over the text (a mask hides the stroke inside the text
 * box) and carries on past it. The edge itself is left untouched.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'
import {
  edgeCrossesTitle,
  titleGapMask,
  titleTextBoxes,
} from '../../packages/svg-renderer/src/title-gaps.ts'
import { FONT_SIZES } from '../../packages/svg-renderer/src/styles.ts'
import type { PositionedEdge, PositionedGroup } from '@zombie-mermaid/core'

const NESTED = `graph TD
  subgraph Cloud
    subgraph us-east [US East Region]
      A[Web Server] --> B[App Server]
    end
    subgraph us-west [US West Region]
      C[Web Server] --> D[App Server]
    end
  end
  E[Load Balancer] --> A
  E --> C`

const PLAIN = `graph TD
  subgraph s [Group]
    A --> B
  end
  C --> D`

function group(partial: Partial<PositionedGroup> = {}): PositionedGroup {
  return {
    id: 'g',
    label: 'Title',
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    children: [],
    ...partial,
  }
}

function edge(points: Array<[number, number]>): PositionedEdge {
  return {
    source: 'a',
    target: 'b',
    style: 'solid',
    hasArrowStart: false,
    hasArrowEnd: true,
    points: points.map(([x, y]) => ({ x, y })),
  } as PositionedEdge
}

describe('title text boxes', () => {
  const [box] = titleTextBoxes([group()], FONT_SIZES)

  it('starts at the text inset and is centred in the title bar', () => {
    expect(box!.x).toBeLessThan(112)
    expect(box!.x + box!.width).toBeGreaterThan(112)
    const centre = box!.y + box!.height / 2
    expect(centre).toBeCloseTo(100 + (FONT_SIZES.groupHeader + 16) / 2, 5)
  })

  it('covers nested groups and skips an empty title', () => {
    const boxes = titleTextBoxes(
      [
        group({ children: [group({ id: 'c', label: 'Inner' })] }),
        group({ label: '' }),
      ],
      FONT_SIZES,
    )
    expect(boxes).toHaveLength(2)
  })
})

describe('edgeCrossesTitle', () => {
  const [box] = titleTextBoxes([group()], FONT_SIZES)
  const midX = box!.x + box!.width / 2

  it('is true for a vertical edge through the text', () => {
    expect(
      edgeCrossesTitle(
        edge([
          [midX, 50],
          [midX, 200],
        ]),
        [box!],
      ),
    ).toBe(true)
  })

  it('is true for a horizontal edge through the text', () => {
    const y = box!.y + box!.height / 2
    expect(
      edgeCrossesTitle(
        edge([
          [0, y],
          [400, y],
        ]),
        [box!],
      ),
    ).toBe(true)
  })

  it('is true for a diagonal edge through the text', () => {
    expect(
      edgeCrossesTitle(
        edge([
          [box!.x - 20, box!.y - 20],
          [box!.x + 20, box!.y + 20],
        ]),
        [box!],
      ),
    ).toBe(true)
  })

  it('is false for an edge to the right of the text, in the same bar', () => {
    const x = box!.x + box!.width + 10
    expect(
      edgeCrossesTitle(
        edge([
          [x, 50],
          [x, 200],
        ]),
        [box!],
      ),
    ).toBe(false)
  })

  it('is false for an edge in the padding beside the text, not through it', () => {
    const x = box!.x + box!.width - 1
    expect(
      edgeCrossesTitle(
        edge([
          [x, 50],
          [x, 200],
        ]),
        [box!],
      ),
    ).toBe(false)
  })

  it('is false for an edge that stops above the text', () => {
    expect(
      edgeCrossesTitle(
        edge([
          [midX, 50],
          [midX, box!.y - 1],
        ]),
        [box!],
      ),
    ).toBe(false)
  })

  it('is false for an edge below the title bar', () => {
    expect(
      edgeCrossesTitle(
        edge([
          [midX, box!.y + 60],
          [midX, 240],
        ]),
        [box!],
      ),
    ).toBe(false)
  })
})

describe('title gap mask', () => {
  const boxes = titleTextBoxes([group()], FONT_SIZES)

  it('uses user-space units, so a straight edge is not masked away', () => {
    expect(titleGapMask(boxes, 400, 300).markup).toContain(
      'maskUnits="userSpaceOnUse"',
    )
  })

  it('cuts one black hole per box out of a white field', () => {
    const { markup } = titleGapMask(boxes, 400, 300)
    expect(markup.match(/fill="#fff"/g)).toHaveLength(1)
    expect(markup.match(/fill="#000"/g)).toHaveLength(boxes.length)
  })

  it('gives the same id for the same boxes and a different id for other boxes', () => {
    const other = titleTextBoxes([group({ x: 130 })], FONT_SIZES)
    expect(titleGapMask(boxes, 400, 300).id).toBe(
      titleGapMask(boxes, 400, 300).id,
    )
    expect(titleGapMask(boxes, 400, 300).id).not.toBe(
      titleGapMask(other, 400, 300).id,
    )
  })
})

describe('rendered output', () => {
  it('does not mask an edge that only grazes the right of a title', () => {
    // A -> B runs at x=102; the "Inner" text ends just left of it.
    const svg = renderMermaidSVG(
      'flowchart TD\n  subgraph Outer\n    subgraph Inner\n      B\n    end\n  end\n  A --> B',
    )
    expect(svg).not.toContain('zm-title-gap')
  })

  it('masks the edges that cross a subgraph title, and only those', () => {
    const svg = renderMermaidSVG(NESTED)
    expect(svg).toContain('<mask id="zm-title-gap-')
    const edges = svg.match(/<polyline [^>]*class="edge"[^>]*>/g)!
    const masked = edges.filter((e) => e.includes('mask="url(#zm-title-gap-'))
    // E -> A and E -> C cross the "US East/West Region" titles.
    expect(masked).toHaveLength(2)
    for (const m of masked) expect(m).toMatch(/data-from="E"/)
    // A -> B and C -> D stay as they were.
    expect(edges.filter((e) => !e.includes('mask='))).toHaveLength(2)
  })

  it('leaves the edge geometry the same as without the mask', () => {
    const svg = renderMermaidSVG(NESTED)
    const unmasked = svg.replace(/ mask="url\(#[^)]*\)"/g, '')
    // Same polyline points either way: the mask is the only difference.
    expect(unmasked.match(/points="[^"]*"/g)).toEqual(
      svg.match(/points="[^"]*"/g),
    )
  })

  it('emits no mask when no edge crosses a title', () => {
    const svg = renderMermaidSVG(PLAIN)
    expect(svg).not.toContain('<mask')
    expect(svg).not.toContain('mask=')
  })

  it('emits no mask for a diagram without subgraphs', () => {
    expect(renderMermaidSVG('graph TD\n  A --> B')).not.toContain('<mask')
  })
})
