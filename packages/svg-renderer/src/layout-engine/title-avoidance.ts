/**
 * Keep edges off subgraph titles.
 *
 * A subgraph's title sits at the top left of its box. An edge from outside to
 * a node inside that comes down over the top of the box can land right on the
 * title text. ELK treats the title area as plain padding and has no way to know,
 * so this pass moves such a segment sideways, clear of the text. When it cannot
 * (the target is too narrow, or a node is in the way), the edge detours down
 * the nearer outer side and enters through the wall just below the title bar.
 */

import { measureMultilineText } from '@zombie-mermaid/core'
import type {
  PositionedEdge,
  PositionedGroup,
  PositionedNode,
  Point,
} from '@zombie-mermaid/core'
import { FONT_SIZES, FONT_WEIGHTS } from '../styles.ts'

/** Height of a subgraph title bar (`fontSizes.groupHeader + 16`, default font). */
export const GROUP_TITLE_HEIGHT = 28

/** Left inset of the title text inside the box, matching the renderer. */
const TITLE_TEXT_INSET = 12

/** Space kept between an edge and the title text, in px. */
const TEXT_CLEARANCE = 0

/** Distance the detour keeps from the box (outside) and from the title (inside), in px. */
const DETOUR_GAP = 10

const EPS = 0.5

function flattenGroups(groups: PositionedGroup[]): PositionedGroup[] {
  return groups.flatMap((g) => [g, ...flattenGroups(g.children)])
}

/** Horizontal extent of the title text, padded by the clearance. */
function titleTextSpan(group: PositionedGroup): {
  left: number
  right: number
} {
  const width = measureMultilineText(
    group.label,
    FONT_SIZES.groupHeader,
    FONT_WEIGHTS.groupHeader,
  ).width
  return {
    left: group.x + TITLE_TEXT_INSET - TEXT_CLEARANCE,
    right: group.x + TITLE_TEXT_INSET + width + TEXT_CLEARANCE,
  }
}

function verticalSegmentHitsNode(
  x: number,
  y1: number,
  y2: number,
  nodes: PositionedNode[],
  skipIds: Set<string>,
): boolean {
  const top = Math.min(y1, y2)
  const bottom = Math.max(y1, y2)
  return nodes.some(
    (n) =>
      !skipIds.has(n.id) &&
      x > n.x &&
      x < n.x + n.width &&
      bottom > n.y &&
      top < n.y + n.height,
  )
}

/**
 * Move the vertical segment `points[i]` to `points[i + 1]` to `newX`, if both
 * ends can follow: each end is either a bend (its neighbour segment is
 * horizontal, so it just gets longer or shorter) or the edge's end on `target`
 * / start on `source`, which must stay on that node's face. Returns false and
 * leaves the points alone otherwise.
 */
function shiftSegment(
  points: Point[],
  i: number,
  newX: number,
  edge: PositionedEdge,
  nodes: PositionedNode[],
): boolean {
  const a = points[i]!
  const b = points[i + 1]!
  const before = points[i - 1]
  // `a` is the segment's upper end, where it arrives from outside the box. It
  // must be a bend fed by a horizontal run, so the run just changes length.
  if (before === undefined || Math.abs(before.y - a.y) >= EPS) return false
  const after = points[i + 2]
  if (after === undefined) {
    const target = nodes.find((n) => n.id === edge.target)
    if (!target) return false
    if (newX <= target.x + EPS || newX >= target.x + target.width - EPS) {
      return false
    }
  } else if (Math.abs(after.y - b.y) >= EPS) {
    return false
  }
  const skip = new Set([edge.source, edge.target])
  if (verticalSegmentHitsNode(newX, a.y, b.y, nodes, skip)) return false
  a.x = newX
  b.x = newX
  return true
}

/**
 * Replace the vertical segment `a` to `b` (entering `group` from above) with a
 * detour down the nearer outer side and in through the wall just under the
 * title bar. Returns the points replacing `b` (they follow `a`).
 */
function detourAroundTitle(
  a: Point,
  b: Point,
  group: PositionedGroup,
  titleHeight: number,
): Point[] {
  const right = group.x + group.width
  const sideX =
    a.x - group.x <= right - a.x ? group.x - DETOUR_GAP : right + DETOUR_GAP
  const titleBottom = group.y + titleHeight
  const approachY = Math.max(a.y, group.y - DETOUR_GAP)
  const entryY = Math.min(titleBottom + DETOUR_GAP, (titleBottom + b.y) / 2)
  const out: Point[] = []
  if (approachY > a.y) out.push({ x: a.x, y: approachY })
  out.push(
    { x: sideX, y: approachY },
    { x: sideX, y: entryY },
    { x: a.x, y: entryY },
    b,
  )
  return out
}

/**
 * Reroute every edge segment that runs down onto a subgraph's title text on its
 * way into the subgraph. Mutates `edges[].points`. Only segments that end inside
 * the box below the title are touched; one that merely passes by is left alone.
 */
export function routeEdgesAroundGroupTitles(
  edges: PositionedEdge[],
  groups: PositionedGroup[],
  nodes: PositionedNode[],
  titleHeight: number = GROUP_TITLE_HEIGHT,
): void {
  const all = flattenGroups(groups)
  for (const edge of edges) {
    for (const group of all) {
      const right = group.x + group.width
      const titleBottom = group.y + titleHeight
      const span = titleTextSpan(group)
      const pts = edge.points
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i]!
        const b = pts[i + 1]!
        const hitsTitleText =
          Math.abs(a.x - b.x) < EPS &&
          a.x > span.left &&
          a.x < span.right &&
          a.x < right - EPS &&
          a.y < group.y - EPS &&
          b.y > titleBottom + EPS
        if (!hitsTitleText) continue
        const clearX = span.right + 10
        if (
          clearX < right - TEXT_CLEARANCE &&
          shiftSegment(pts, i, clearX, edge, nodes)
        ) {
          break
        }
        pts.splice(i + 1, 1, ...detourAroundTitle(a, b, group, titleHeight))
        break
      }
    }
  }
}
