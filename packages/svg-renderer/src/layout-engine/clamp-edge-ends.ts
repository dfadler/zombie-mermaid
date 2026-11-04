import type {
  PositionedGraph,
  PositionedNode,
  Point,
} from '@zombie-mermaid/core'

/**
 * Pull an edge's end back onto its node's face. Without bundling, the compound
 * layout can leave an end a few px past the box's corner (the box was widened
 * after the edge was routed). The end moves along the face, and the bend next to
 * it moves with it so the segment stays straight.
 */
function clampEnd(end: Point, next: Point, node: PositionedNode): void {
  if (end.x === next.x) {
    const x = Math.min(Math.max(end.x, node.x), node.x + node.width)
    end.x = x
    next.x = x
  } else if (end.y === next.y) {
    const y = Math.min(Math.max(end.y, node.y), node.y + node.height)
    end.y = y
    next.y = y
  }
}

export function clampEdgeEnds(graph: PositionedGraph): PositionedGraph {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]))
  for (const e of graph.edges) {
    const p = e.points
    const source = nodes.get(e.source)
    const target = nodes.get(e.target)
    // A diamond's face is a slope, not its box.
    if (p.length < 2 || !source || !target) continue
    if (source.shape !== 'diamond') clampEnd(p[0]!, p[1]!, source)
    if (target.shape !== 'diamond')
      clampEnd(p[p.length - 1]!, p[p.length - 2]!, target)
  }
  return graph
}
