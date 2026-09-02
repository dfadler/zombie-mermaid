/**
 * Shared ELK-edge-geometry extraction helpers.
 *
 * `from-elk.ts` (flowchart/state), `src/class/layout.ts`, and
 * `src/er/layout.ts` each independently walk an ELK edge's
 * `section.startPoint → bendPoints → endPoint` into a `Point[]`, plus
 * near-identical edge-label-position math. This module is the single
 * place that logic lives, so the three call sites can't drift.
 */

import type { ElkExtendedEdge } from 'elkjs'
import type { Point } from '../types.ts'

/**
 * Walk an ELK edge's first routed section into a flat point path:
 * `startPoint → bendPoints → endPoint`.
 *
 * ELK can theoretically produce multiple sections per edge (for edges
 * split across hierarchy boundaries via ports), but all three call sites
 * only ever read `sections[0]` — hierarchical decomposition in this
 * codebase is handled by emitting separate ELK edges (see
 * `to-elk.ts`/`parseHopEdgeId` in `from-elk.ts`), not multi-section edges.
 *
 * `offsetX`/`offsetY` translate the section's coordinates into an
 * ancestor's coordinate space, for callers walking a nested ELK result
 * (`from-elk.ts`). Callers with a flat (non-hierarchical) ELK graph
 * (`class/layout.ts`, `er/layout.ts`) can omit them.
 *
 * Returns an empty array if the edge has no routed sections.
 */
export function extractEdgePoints(
  elkEdge: ElkExtendedEdge,
  offsetX = 0,
  offsetY = 0,
): Point[] {
  const points: Point[] = []
  if (!elkEdge.sections || elkEdge.sections.length === 0) return points

  const section = elkEdge.sections[0]!
  points.push({
    x: section.startPoint.x + offsetX,
    y: section.startPoint.y + offsetY,
  })
  if (section.bendPoints) {
    for (const bp of section.bendPoints) {
      points.push({ x: bp.x + offsetX, y: bp.y + offsetY })
    }
  }
  points.push({
    x: section.endPoint.x + offsetX,
    y: section.endPoint.y + offsetY,
  })

  return points
}

/**
 * Compute an edge label's center position from ELK's placed label box
 * (`label.x/y` is the box's top-left corner).
 *
 * `offsetX`/`offsetY` translate into an ancestor's coordinate space, same
 * as `extractEdgePoints`.
 *
 * Returns `undefined` if ELK didn't place a label (no label on the edge,
 * or ELK left `x`/`y` unset).
 */
export function extractEdgeLabelPosition(
  elkEdge: ElkExtendedEdge,
  offsetX = 0,
  offsetY = 0,
): Point | undefined {
  if (!elkEdge.labels || elkEdge.labels.length === 0) return undefined

  const label = elkEdge.labels[0]!
  if (label.x == null || label.y == null) return undefined

  return {
    x: label.x + (label.width ?? 0) / 2 + offsetX,
    y: label.y + (label.height ?? 0) / 2 + offsetY,
  }
}
