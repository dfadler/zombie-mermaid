// ============================================================================
// Edges between a node and a subgraph that contains it (#1310)
//
// Real mermaid.js (11.17.2, checked headlessly) accepts `B --> Sub` with B
// inside Sub, and `Sub --> B`, without erroring, but its layout produces a
// zero-length path (`M x,yZ`) for the edge: no line joins the two, only a
// stray arrowhead marker is left floating beside the node. Both renderers
// here treat such an edge as undrawable and omit it; this module is the one
// place that decides which edges those are, so the SVG and ASCII renderers
// cannot disagree.
// ============================================================================

import type { MermaidGraph, MermaidSubgraph } from './types.ts'

/** Collect `id` and every descendant subgraph into `byId`. */
function indexSubgraph(
  sg: MermaidSubgraph,
  byId: Map<string, MermaidSubgraph>,
): void {
  byId.set(sg.id, sg)
  for (const child of sg.children) indexSubgraph(child, byId)
}

/**
 * True when one endpoint of `edge` is a subgraph id and the other is a node or
 * subgraph nested inside it, at any depth.
 */
export function isEdgeWithinOwnCluster(
  edge: { source: string; target: string },
  subgraphById: Map<string, MermaidSubgraph>,
): boolean {
  const contains = (clusterId: string, innerId: string): boolean => {
    const sg = subgraphById.get(clusterId)
    if (!sg) return false
    const inside = new Set<string>()
    collectInsideIds(sg, inside)
    return inside.has(innerId)
  }
  return (
    contains(edge.target, edge.source) || contains(edge.source, edge.target)
  )
}

/** Every node id and descendant subgraph id nested inside `sg`. */
function collectInsideIds(sg: MermaidSubgraph, out: Set<string>): void {
  for (const id of sg.nodeIds) out.add(id)
  for (const child of sg.children) {
    out.add(child.id)
    collectInsideIds(child, out)
  }
}

/**
 * `graph` without its edges between a node and a subgraph that contains it.
 * The parser also registers a subgraph id used as an edge endpoint as a
 * placeholder entry in `graph.nodes`; one no remaining edge refers to is
 * removed too, so the result equals the graph parsed without those edges.
 * Returns `graph` itself (same reference) when it has none, and never mutates
 * its input.
 */
export function withoutOwnClusterEdges(graph: MermaidGraph): MermaidGraph {
  if (graph.subgraphs.length === 0) return graph
  const byId = new Map<string, MermaidSubgraph>()
  for (const sg of graph.subgraphs) indexSubgraph(sg, byId)
  const edges = graph.edges.filter((e) => !isEdgeWithinOwnCluster(e, byId))
  if (edges.length === graph.edges.length) return graph

  const referenced = new Set<string>()
  for (const e of edges) {
    referenced.add(e.source)
    referenced.add(e.target)
  }
  const nodes = new Map(graph.nodes)
  for (const id of byId.keys()) {
    if (!referenced.has(id)) nodes.delete(id)
  }
  return { ...graph, nodes, edges }
}
