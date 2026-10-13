// ============================================================================
// Whether a subgraph's explicit `direction` is honored (#1699)
//
// Measured on mermaid 11.17.2 and 12.1.0 (the latest at the time): a subgraph
// lays itself out in its own `direction` unless an edge crosses its boundary,
// or crosses the boundary of an ancestor. An edge to or from the subgraph's
// own id does not cross it, so `X --> S` keeps `direction LR` for `S`. A
// nested subgraph's id counts as inside its parent, so `X --> Inner` crosses
// the parent, and `Inner` then follows the parent's layout.
//
// Shared by the SVG and ASCII renderers so they cannot disagree.
// ============================================================================

import type { MermaidGraph, MermaidSubgraph } from './types.ts'

/** Every node id and nested subgraph id strictly inside `sg`. */
function inside(sg: MermaidSubgraph, out = new Set<string>()): Set<string> {
  for (const id of sg.nodeIds) out.add(id)
  for (const child of sg.children) {
    out.add(child.id)
    inside(child, out)
  }
  return out
}

/** `sg` and each subgraph it sits in, outermost first, or undefined if absent. */
function chainTo(
  subgraphs: MermaidSubgraph[],
  target: MermaidSubgraph,
): MermaidSubgraph[] | undefined {
  for (const sg of subgraphs) {
    if (sg === target) return [sg]
    const below = chainTo(sg.children, target)
    if (below) return [sg, ...below]
  }
  return undefined
}

/**
 * Whether `sg`'s own `direction` applies. False when an edge has exactly one
 * end inside `sg` or inside any subgraph that contains it.
 */
export function subgraphDirectionIsHonored(
  sg: MermaidSubgraph,
  graph: MermaidGraph,
): boolean {
  const chain = chainTo(graph.subgraphs, sg) ?? [sg]
  return chain.every((s) => {
    const ids = inside(s)
    if (ids.size === 0) return true
    return !graph.edges.some((e) => ids.has(e.source) !== ids.has(e.target))
  })
}
