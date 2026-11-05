/**
 * Keep an edge's cross-flow run off a subgraph's side (#1749, #1796).
 */

import type {
  Direction,
  PositionedEdge,
  PositionedGroup,
  PositionedNode,
} from '@zombie-mermaid/core'

const isVertical = (direction: Direction): boolean =>
  direction === 'TD' || direction === 'TB' || direction === 'BT'

/** Least space an edge's cross-flow run keeps from a box's side, in px. */
const BORDER_GAP = 8

/**
 * The layout routes edges before the boxes are drawn, so a run of an edge that
 * travels across the flow (a fan-out trunk in a left-to-right graph) can land
 * a px or two from a box's side and read as part of the border. Move such a
 * run out to `BORDER_GAP` from the side it is on, when that stays between the
 * run's neighbouring points and clear of every node. Every edge of a shared
 * trunk gets the same move.
 */
export function clearBorders(
  edges: PositionedEdge[],
  nodes: PositionedNode[],
  groups: PositionedGroup[],
  direction: Direction,
): void {
  const k = isVertical(direction) ? 'y' : 'x'
  const o = k === 'x' ? 'y' : 'x'
  const size = k === 'x' ? 'width' : 'height'
  const osize = k === 'x' ? 'height' : 'width'
  for (const { points } of edges) {
    for (let i = 1; i < points.length - 1;) {
      let j = i
      while (j + 1 < points.length - 1 && points[j + 1]![k] === points[i]![k]) {
        j++
      }
      const run = points.slice(i, j + 1)
      const at = run[0]!
      const lo = Math.min(...run.map((p) => p[o]))
      const hi = Math.max(...run.map((p) => p[o]))
      const before = points[i - 1]![k]
      const after = points[j + 1]![k]
      const side = groups
        .flatMap((g) => [g[k], g[k] + g[size]].map((s) => ({ g, s })))
        .find(
          ({ g, s }) =>
            Math.abs(at[k] - s) < BORDER_GAP &&
            hi > g[o] &&
            lo < g[o] + g[osize],
        )
      if (side) {
        const to = side.s + (at[k] >= side.s ? BORDER_GAP : -BORDER_GAP)
        const between = (to - before) * (after - to) > 0
        const clear = nodes.every(
          (n) =>
            n[k] + n[size] <= to ||
            n[k] >= to ||
            n[o] + n[osize] <= lo ||
            n[o] >= hi,
        )
        if (between && clear) for (const p of run) p[k] = to
      }
      i = j + 1
    }
  }
}
