/**
 * Which edges of a flowchart are "back edges", found the way mermaid.js finds
 * them.
 *
 * mermaid lays a flowchart out with dagre, which makes the graph acyclic by a
 * depth-first walk: starting from each node in order and following out-edges
 * in source order, an edge that points at a node still on the walk's stack is
 * reversed. Which edge of a cycle gets reversed decides the whole layout. In
 * the CI/CD sample `D -.-> A` closes the cycle `A -> B -> D -> A`, and walking
 * `A -> B -> C -> E -> F` reaches `D` through `F --> D` first, so `D -.-> A` is
 * the back edge and `D` ("Fix & Retry") sits after `F`.
 *
 * ELK's own cycle breaking picks a different edge (`F --> D`), puts `D` early,
 * and draws the long way round. It also treats a subgraph's contents
 * separately from the rest of the graph, so no ELK setting reproduces the
 * dagre result (#1239). Handing ELK these edges already reversed means it never
 * has a cycle to break.
 */

import type { MermaidGraph } from '@zombie-mermaid/core'

/**
 * Indices into `graph.edges` of the edges a depth-first walk reverses.
 * Self-loops are never back edges here; layout handles them on their own.
 *
 * `walkOrder` is the order the walk starts from; it defaults to the graph's
 * node order, which is mermaid's (first appearance in the source).
 */
export function findBackEdgeIndexes(
  graph: MermaidGraph,
  walkOrder?: Iterable<string>,
): Set<number> {
  const outEdges = new Map<string, number[]>()
  graph.edges.forEach((edge, index) => {
    if (edge.source === edge.target) return
    const list = outEdges.get(edge.source)
    if (list) list.push(index)
    else outEdges.set(edge.source, [index])
  })

  const back = new Set<number>()
  const visited = new Set<string>()
  const onStack = new Set<string>()

  // Iterative, so a long chain can't overflow the call stack.
  for (const root of walkOrder ?? graph.nodes.keys()) {
    if (visited.has(root)) continue
    const stack: Array<{ node: string; next: number }> = [
      { node: root, next: 0 },
    ]
    visited.add(root)
    onStack.add(root)
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!
      const edges = outEdges.get(frame.node) ?? []
      if (frame.next >= edges.length) {
        onStack.delete(frame.node)
        stack.pop()
        continue
      }
      const index = edges[frame.next++]!
      const target = graph.edges[index]!.target
      if (onStack.has(target)) {
        back.add(index)
      } else if (!visited.has(target)) {
        visited.add(target)
        onStack.add(target)
        stack.push({ node: target, next: 0 })
      }
    }
  }
  return back
}
