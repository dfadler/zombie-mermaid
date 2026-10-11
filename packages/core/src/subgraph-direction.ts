// ============================================================================
// Inner direction of a flowchart subgraph (#1699)
//
// mermaid.js (11.17.2, `adjustClustersAndEdges` + `extractor` in its dagre
// wrapper) lays out a subgraph with no edge crossing its boundary as its own
// graph, perpendicular to the graph around it, unless the subgraph states a
// `direction`. A subgraph with a crossing edge stays in the parent's layout and
// its `direction` is ignored. An edge to or from the subgraph's own id does not
// cross: only an edge with exactly one end among the subgraph's descendants
// (nodes, or nested subgraph ids) does.
//
// Shared by the SVG and ASCII renderers so they cannot disagree.
// ============================================================================

import type { Direction, MermaidGraph, MermaidSubgraph } from './types.ts'

const cache = new WeakMap<MermaidGraph, Map<string, Direction> | null>()

/** Every node id and nested subgraph id strictly inside `sg`. */
function descendants(
  sg: MermaidSubgraph,
  out = new Set<string>(),
): Set<string> {
  for (const id of sg.nodeIds) out.add(id)
  for (const child of sg.children) {
    out.add(child.id)
    descendants(child, out)
  }
  return out
}

/**
 * The direction each subgraph of a flowchart is laid out in, keyed by subgraph
 * id, or `undefined` for a graph that does not flip (state, architecture): the
 * caller then keeps its own handling of an explicit `direction`.
 */
export function subgraphDirections(
  graph: MermaidGraph,
): Map<string, Direction> | undefined {
  if (!graph.flipsSubgraphs) return undefined
  const hit = cache.get(graph)
  if (hit !== undefined) return hit ?? undefined
  const out = new Map<string, Direction>()
  const walk = (sg: MermaidSubgraph, parent: Direction): void => {
    const inside = descendants(sg)
    const crossed = graph.edges.some(
      (e) => inside.has(e.source) !== inside.has(e.target),
    )
    // mermaid maps TD to TB, and flips only TB to LR: anything else goes to TB.
    const flipped: Direction = parent === 'TD' || parent === 'TB' ? 'LR' : 'TB'
    const dir = crossed ? parent : (sg.direction ?? flipped)
    out.set(sg.id, dir)
    for (const child of sg.children) walk(child, dir)
  }
  for (const sg of graph.subgraphs) walk(sg, graph.direction)
  cache.set(graph, out)
  return out
}
