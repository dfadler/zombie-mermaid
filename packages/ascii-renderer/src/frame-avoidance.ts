/**
 * Keep edges out of subgraph frames they neither start nor end in (#1197).
 *
 * A cycle across sibling subgraphs (`A --> C --> E --> A`, each in its own
 * frame) routes its back-edge `E --> A` up the shared gap column beside the
 * frames, which is *inside* every intermediate frame once the frame is
 * widened to fit its title: the line reads as belonging to those subgraphs
 * and strikes through their titles. Real mermaid routes it around the
 * outside of the frames it merely passes.
 *
 * Subgraph frames are drawn after routing and are not tracked in the grid
 * (see docs/decisions/cluster-exit-anchoring-*.md), so this works in two
 * steps, both in grid space:
 *
 * 1. `blockUnrelatedFrames`: while an edge is routed, the cells a frame's
 *    node block spans are reserved, so A* detours into the gap column/row
 *    beside them. A frame the edge starts or ends in (directly or via nesting) is
 *    left open: crossing its wall is forced.
 * 2. `widenFrameGutters`: once frames are measured (a long title widens its
 *    frame past the gap column's centre), widen the gap until each
 *    avoiding edge's straight run clears every frame wall it passes beside.
 *
 * Gap rows/columns *along* the flow are not blocked: a run there sits
 * outside the frame (the wall is two characters from the node, the run's
 * line is at the centre of a padding-wide gap), and sibling fan-out jogs
 * live there.
 */

import type { AsciiEdge, AsciiGraph, AsciiSubgraph } from './types.ts'
import { gridKey } from './types.ts'
import { clusterGridBox } from './cluster-boundary.ts'
import { gridToDrawingCoord } from './grid.ts'

/** Safety bound on widening passes. */
const MAX_PASSES = 16

function isRelated(sg: AsciiSubgraph, edge: AsciiEdge): boolean {
  return sg.nodes.includes(edge.from) || sg.nodes.includes(edge.to)
}

/**
 * Reserve, in `graph.grid`, the cells of every frame `edge` has no endpoint
 * in. Returns the keys it added (cells already occupied are left alone), for
 * `unblock` to release once the edge is routed, and whether any unrelated
 * frame exists at all (the edge then gets the wall-clearance check).
 */
export function blockUnrelatedFrames(
  graph: AsciiGraph,
  edge: AsciiEdge,
): { added: string[]; engaged: boolean } {
  const added: string[] = []
  let engaged = false
  for (const sg of graph.subgraphs) {
    if (isRelated(sg, edge)) continue
    const box = clusterGridBox(sg)
    if (!box) continue
    engaged = true
    for (let x = box.minX; x <= box.maxX; x++) {
      for (let y = box.minY; y <= box.maxY; y++) {
        const key = gridKey({ x, y })
        if (graph.grid.has(key)) continue
        graph.grid.add(key)
        added.push(key)
      }
    }
  }
  return { added, engaged }
}

/** Release cells reserved by `blockUnrelatedFrames`. */
export function unblock(graph: AsciiGraph, keys: readonly string[]): void {
  for (const key of keys) graph.grid.delete(key)
}

/**
 * Widen gap columns (rows, for LR) until every edge in `edges` runs clear of
 * the frame walls it passes beside. Returns whether any size changed, in
 * which case the caller must recompute drawing coordinates and subgraph
 * boxes (`recompute`, called between passes so each pass measures fresh
 * walls).
 */
export function widenFrameGutters(
  graph: AsciiGraph,
  edges: ReadonlySet<AsciiEdge>,
  recompute: () => void,
): boolean {
  if (edges.size === 0) return false
  const vertical = graph.config.graphDirection !== 'LR'
  const sizes = vertical ? graph.columnWidth : graph.rowHeight
  let changed = false
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const fix = findViolation(graph, edges, vertical)
    if (!fix) break
    sizes.set(fix.index, (sizes.get(fix.index) ?? 0) + fix.by)
    changed = true
    recompute()
  }
  return changed
}

interface Widening {
  index: number
  by: number
}

/** First straight run that touches or sits inside a frame it passes beside. */
function findViolation(
  graph: AsciiGraph,
  edges: ReadonlySet<AsciiEdge>,
  vertical: boolean,
): Widening | null {
  for (const edge of edges) {
    const path = edge.path
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!
      const b = path[i]!
      // Only runs along the flow axis (vertical in TD, horizontal in LR).
      if (vertical ? a.x !== b.x || a.y === b.y : a.y !== b.y || a.x === b.x) {
        continue
      }
      const line = vertical ? a.x : a.y
      const lineD = vertical
        ? gridToDrawingCoord(graph, a).x
        : gridToDrawingCoord(graph, a).y
      const from = vertical
        ? gridToDrawingCoord(graph, a).y
        : gridToDrawingCoord(graph, a).x
      const to = vertical
        ? gridToDrawingCoord(graph, b).y
        : gridToDrawingCoord(graph, b).x
      const lo = Math.min(from, to)
      const hi = Math.max(from, to)
      for (const sg of graph.subgraphs) {
        const box = clusterGridBox(sg)
        if (!box) continue
        const wallLo = vertical ? sg.minX : sg.minY
        const wallHi = vertical ? sg.maxX : sg.maxY
        const spanLo = vertical ? sg.minY : sg.minX
        const spanHi = vertical ? sg.maxY : sg.maxX
        // The run must pass beside the frame, not end at/inside it.
        if (hi <= spanLo || lo >= spanHi) continue
        const boxLo = vertical ? box.minX : box.minY
        const boxHi = vertical ? box.maxX : box.maxY
        if (line > boxHi) {
          // Past the frame's far side: the line must be strictly outside the
          // wall, even for a frame the edge ends in (it should cross that
          // wall perpendicular, not ride up its interior).
          if (lineD > wallHi) continue
          const need = wallHi + 1 - lineD
          // The gap column right beside the box is the widenable one; if the
          // line already sits in it, widening it moves the centre by half.
          return line - 1 > boxHi
            ? { index: line - 1, by: need }
            : { index: line, by: 2 * need }
        }
        if (line < boxLo) {
          if (lineD < wallLo) continue
          const need = lineD + 1 - wallLo
          return line + 1 < boxLo
            ? { index: line + 1, by: need }
            : { index: line, by: 2 * need }
        }
      }
    }
  }
  return null
}
