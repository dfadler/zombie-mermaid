// ============================================================================
// Requirement diagram layout (ELK.js)
//
// Box geometry is Mermaid's `requirementBox` shape (mermaid@12.3.0, the
// default `classic`/`neo` looks alike):
//   - every row (`<<Type>>`, the bold name, each body row) is a 24px HTML
//     label; type and name are centred, body rows left-aligned 10px in
//   - the body starts 20px under the name, behind a divider drawn there; a box
//     with no body rows is just the two rows
//   - the box is the text's bounding box plus 20px each way
//   - an edge label is `<<relationship>>`, 24px high
// Text is measured with Trebuchet MS advances (Mermaid's first font), as the
// timeline layout does. Only the line routing differs from Mermaid (dagre
// there, ELK here); the canvas is the boxes plus 8px each way.
// ============================================================================

import type { ElkNode } from '@zombie-mermaid/core'
import { resolveNodeStyle } from '@zombie-mermaid/core'
import type {
  PositionedRequirementDiagram,
  PositionedRequirementEdge,
  PositionedRequirementNode,
  RequirementDiagram,
} from '@zombie-mermaid/mermaid-parser'
import { requirementBodyRows } from '@zombie-mermaid/mermaid-parser'
import type { RenderOptions } from '@zombie-mermaid/core'
import { elkLayoutSync } from '../elk-instance.ts'
import { extractEdgePoints } from '../layout-engine/elk-adapter-utils.ts'
import {
  ELK_DIRECTION_FALLBACK,
  baseElkLayoutOptions,
  buildElkLeafNode,
  directionToElk,
} from '../layout-engine/elk-graph-builder.ts'
import { textWidth as advanceWidth } from '../timeline/layout.ts'
import { trebuchetKerning } from './kerning.ts'

/** Text width as Chromium measures it: Trebuchet MS advances plus kerning, at 16px. */
function textWidth(text: string, bold = false): number {
  return advanceWidth(text, 16, bold) + trebuchetKerning(text, bold)
}

export const REQUIREMENT = {
  fontSize: 16,
  rowHeight: 24,
  /** Space between the name row and the first body row. */
  bodyGap: 20,
  /** Added to the text's bounding box, both axes. */
  boxPad: 20,
  /** Where the text block starts under the box's top edge, and a body row's left inset. */
  textTop: 8,
  rowInset: 10,
  /** The canvas margin around the boxes. */
  margin: 8,
  nodeSpacing: 40,
  layerSpacing: 40,
  /** How far a self-relationship loop leaves the box, and the room beside it. */
  loopOut: 20,
  loopLabelGap: 4,
  loopHalf: 12,
} as const

/** The render options the layout reads. */
export type RequirementRenderOptions = Pick<
  RenderOptions,
  'direction' | 'layoutCache'
>

/** The label of a relationship: `<<satisfies>>`. */
export function relationLabel(type: string): string {
  return `<<${type}>>`
}

function boxSize(
  typeText: string,
  name: string,
  rows: string[],
): { width: number; height: number } {
  const widest = Math.max(
    textWidth(typeText),
    textWidth(name, true),
    ...rows.map((r) => textWidth(r)),
  )
  const textHeight =
    REQUIREMENT.rowHeight * 2 +
    (rows.length > 0
      ? REQUIREMENT.bodyGap + REQUIREMENT.rowHeight * rows.length
      : 0)
  return {
    width: widest + REQUIREMENT.boxPad,
    height: textHeight + REQUIREMENT.boxPad,
  }
}

function midpoint(points: Array<{ x: number; y: number }>): {
  x: number
  y: number
} {
  let total = 0
  for (let i = 1; i < points.length; i++)
    total += Math.hypot(
      points[i]!.x - points[i - 1]!.x,
      points[i]!.y - points[i - 1]!.y,
    )
  let walked = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const seg = Math.hypot(b.x - a.x, b.y - a.y)
    if (seg > 0 && walked + seg >= total / 2) {
      const t = (total / 2 - walked) / seg
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    walked += seg
  }
  return points[0]!
}

/** The point of a polyline closest to `p`. */
function nearestOnPolyline(
  points: Array<{ x: number; y: number }>,
  p: { x: number; y: number },
): { x: number; y: number } {
  let best = points[0]!
  let bestDist = Infinity
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
    const t =
      len2 === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2,
            ),
          )
    const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    const d = Math.hypot(q.x - p.x, q.y - p.y)
    if (d < bestDist) {
      bestDist = d
      best = q
    }
  }
  return best
}

/** Lay out a parsed requirement diagram using ELK.js (synchronous). */
export function layoutRequirementDiagramSync(
  diagram: RequirementDiagram,
  options: RequirementRenderOptions = {},
): PositionedRequirementDiagram {
  if (diagram.nodes.length === 0)
    return { width: 16, height: 16, nodes: [], edges: [] }

  const sizes = new Map<string, { width: number; height: number }>()
  const rowsOf = new Map<string, string[]>()
  for (const n of diagram.nodes) {
    const rows = requirementBodyRows(n)
    rowsOf.set(n.id, rows)
    sizes.set(n.id, boxSize(`<<${n.typeLabel}>>`, n.id, rows))
  }

  const m = REQUIREMENT.margin
  const edges = diagram.relationships.flatMap((rel, i) =>
    rel.src === rel.dst
      ? []
      : [
          {
            id: `e${i}`,
            sources: [rel.src],
            targets: [rel.dst],
            labels: [
              {
                text: relationLabel(rel.type),
                width: textWidth(relationLabel(rel.type)),
                height: REQUIREMENT.rowHeight,
              },
            ],
          },
        ],
  )
  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      ...baseElkLayoutOptions({
        direction: directionToElk(
          options.direction ?? diagram.direction,
          ELK_DIRECTION_FALLBACK.requirement,
        ),
        nodeSpacing: REQUIREMENT.nodeSpacing,
        layerSpacing: REQUIREMENT.layerSpacing,
        padding: m,
      }),
      'elk.edgeLabels.placement': 'CENTER',
      // Declaration order breaks ties and disconnected parts keep it, as in
      // Mermaid's own layouts.
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.separateConnectedComponents': 'false',
      'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
    },
    children: diagram.nodes.map((n) =>
      buildElkLeafNode(n.id, sizes.get(n.id)!),
    ),
    edges,
  }
  const result = elkLayoutSync(elkGraph, options.layoutCache)

  const nodes: PositionedRequirementNode[] = diagram.nodes.map((n) => {
    const child = (result.children ?? []).find((c) => c.id === n.id)!
    const size = sizes.get(n.id)!
    const rows = rowsOf.get(n.id)!
    const x = child.x ?? 0
    const y = child.y ?? 0
    const className = diagram.classAssignments.get(n.id)
    const inlineStyle = resolveNodeStyle(n.id, diagram)
    return {
      id: n.id,
      kind: n.kind,
      typeText: `<<${n.typeLabel}>>`,
      name: n.id,
      rows,
      x,
      y,
      width: child.width ?? size.width,
      height: child.height ?? size.height,
      ...(rows.length > 0 && {
        dividerY: y + REQUIREMENT.rowHeight * 2 + REQUIREMENT.bodyGap,
      }),
      ...(inlineStyle && { inlineStyle }),
      ...(className && { className }),
    }
  })
  const byId = new Map(nodes.map((n) => [n.id, n]))

  const elkEdges = new Map((result.edges ?? []).map((e) => [e.id, e]))
  const positioned: PositionedRequirementEdge[] = diagram.relationships.map(
    (rel, i) => {
      const label = relationLabel(rel.type)
      const labelWidth = textWidth(label)
      const base = {
        type: rel.type,
        src: rel.src,
        dst: rel.dst,
        label,
        labelWidth,
        labelHeight: REQUIREMENT.rowHeight,
      }
      if (rel.src !== rel.dst) {
        const elkEdge = elkEdges.get(`e${i}`)!
        const points = extractEdgePoints(elkEdge)
        // ELK reserves the label's own slot beside the line; Mermaid draws the
        // label on the line, so take the line's point nearest that slot.
        const slot = elkEdge.labels?.[0]
        return {
          ...base,
          points,
          labelPoint:
            slot?.x !== undefined && slot.y !== undefined
              ? nearestOnPolyline(points, {
                  x: slot.x + (slot.width ?? labelWidth) / 2,
                  y: slot.y + (slot.height ?? REQUIREMENT.rowHeight) / 2,
                })
              : midpoint(points),
        }
      }
      // A self-relationship: a loop out of the box's left side, label beyond it,
      // as Mermaid draws it (the canvas grows to hold both).
      const box = byId.get(rel.src)!
      const cy = box.y + box.height / 2
      const lx = box.x - REQUIREMENT.loopOut
      const half = Math.max(REQUIREMENT.loopHalf, box.height / 8)
      return {
        ...base,
        points: [
          { x: box.x, y: cy - half },
          { x: lx, y: cy - half },
          { x: lx, y: cy + half },
          { x: box.x, y: cy + half },
        ],
        labelPoint: {
          x: lx - REQUIREMENT.loopLabelGap - labelWidth / 2,
          y: cy,
        },
      }
    },
  )

  // The canvas is the bounding box of the boxes, lines and labels plus the
  // margin, whatever room ELK left around them.
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const grow = (x1: number, y1: number, x2: number, y2: number) => {
    minX = Math.min(minX, x1)
    minY = Math.min(minY, y1)
    maxX = Math.max(maxX, x2)
    maxY = Math.max(maxY, y2)
  }
  for (const n of nodes) grow(n.x, n.y, n.x + n.width, n.y + n.height)
  for (const e of positioned) {
    for (const p of e.points) grow(p.x, p.y, p.x, p.y)
    grow(
      e.labelPoint.x - e.labelWidth / 2,
      e.labelPoint.y - e.labelHeight / 2,
      e.labelPoint.x + e.labelWidth / 2,
      e.labelPoint.y + e.labelHeight / 2,
    )
  }
  const dx = m - minX
  const dy = m - minY
  for (const n of nodes) {
    n.x += dx
    n.y += dy
    if (n.dividerY !== undefined) n.dividerY += dy
  }
  for (const e of positioned) {
    for (const p of e.points) {
      p.x += dx
      p.y += dy
    }
    e.labelPoint.x += dx
    e.labelPoint.y += dy
  }
  return {
    width: maxX - minX + 2 * m,
    height: maxY - minY + 2 * m,
    nodes,
    edges: positioned,
  }
}
