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

import type { MermaidGraph, MermaidSubgraph } from './types.ts'

/**
 * Indices into `graph.edges` of the edges a depth-first walk reverses.
 * Self-loops are never back edges here; layout handles them on their own.
 *
 * `walkOrder` is the order the walk starts from; it defaults to the graph's
 * node order, which is mermaid's (first appearance in the source).
 *
 * `feedback` edges (see `subgraphFeedbackEdges`) are laid out reversed
 * regardless, so the walk runs over the graph with them flipped; an edge the
 * walk then finds is flipped back. The result includes `feedback` itself.
 */
export function findBackEdgeIndexes(
  graph: MermaidGraph,
  walkOrder?: Iterable<string>,
  feedback: ReadonlySet<number> = new Set(),
): Set<number> {
  const edges = graph.edges.map((e, i) =>
    feedback.has(i) ? { source: e.target, target: e.source } : e,
  )
  const out = new Set(feedback)
  for (const i of findBackEdges(edges, walkOrder ?? graph.nodes.keys())) {
    if (!out.delete(i)) out.add(i)
  }
  return out
}

/**
 * Edges that close a cycle between subgraphs (or between a subgraph and the
 * nodes around it), found the way mermaid 12's ELK layout finds them
 * (`orientFeedbackEdges`, `subgraphFeedbackEdges.ts` in mermaid's ELK layout
 * algorithm; read in mermaid 12.1.0, same positions in 12.2.0).
 *
 * Each edge is lifted to the two children of the subgraph that contains both
 * ends, and a depth-first walk over those children (sources first, then
 * everything, in the order edges first mention them) finds the lifted edges
 * that point back at a child still on the walk's stack. Only an edge that was
 * actually lifted (an end sits inside a subgraph) is reported; an edge between
 * siblings is left to `findBackEdges`. In the CI/CD sample `F --> D` runs from
 * outside the `ci` subgraph back into it, so it is the feedback edge, and
 * `D -.-> A`, inside it, is not reversed: `D` sits beside `C`, not below `F`.
 */
export function subgraphFeedbackEdges(graph: MermaidGraph): Set<number> {
  const ROOT = ''
  const parent = new Map<string, string>()
  const walkTree = (subgraphs: MermaidGraph['subgraphs'], up: string): void => {
    for (const sg of subgraphs) {
      parent.set(sg.id, up)
      for (const id of sg.nodeIds) parent.set(id, sg.id)
      walkTree(sg.children, sg.id)
    }
  }
  walkTree(graph.subgraphs, ROOT)
  // `id` and every subgraph around it, innermost first.
  const chain = (id: string): string[] => {
    const out = [id]
    for (let p = parent.get(id); p; p = parent.get(p)) out.push(p)
    return out
  }

  interface Lifted {
    index: number
    from: string
    to: string
    lifted: boolean
  }
  const levels = new Map<string, Lifted[]>()
  graph.edges.forEach((edge, index) => {
    const up = chain(edge.source)
    const down = chain(edge.target)
    if (up.includes(edge.target) || down.includes(edge.source)) return
    const common = up.find((id) => down.includes(id)) ?? ROOT
    const childOf = (c: string[]): string =>
      common === ROOT ? c[c.length - 1]! : c[c.indexOf(common) - 1]!
    const from = childOf(up)
    const to = childOf(down)
    const list = levels.get(common) ?? []
    list.push({
      index,
      from,
      to,
      lifted: from !== edge.source || to !== edge.target,
    })
    levels.set(common, list)
  })

  const feedback = new Set<number>()
  for (const level of levels.values()) {
    const out = new Map<string, Lifted[]>()
    const inDegree = new Map<string, number>()
    for (const e of level) {
      for (const id of [e.from, e.to]) {
        if (!out.has(id)) {
          out.set(id, [])
          inDegree.set(id, 0)
        }
      }
      out.get(e.from)!.push(e)
      inDegree.set(e.to, inDegree.get(e.to)! + 1)
    }
    const ids = [...out.keys()]
    const state = new Map<string, 'open' | 'done'>()
    for (const root of [
      ...ids.filter((id) => inDegree.get(id) === 0),
      ...ids,
    ]) {
      if (state.has(root)) continue
      state.set(root, 'open')
      const stack = [{ id: root, next: 0 }]
      while (stack.length > 0) {
        const frame = stack[stack.length - 1]!
        const outs = out.get(frame.id)!
        if (frame.next >= outs.length) {
          state.set(frame.id, 'done')
          stack.pop()
          continue
        }
        const e = outs[frame.next++]!
        const seen = state.get(e.to)
        if (seen === 'open') {
          if (e.lifted) feedback.add(e.index)
        } else if (seen === undefined) {
          state.set(e.to, 'open')
          stack.push({ id: e.to, next: 0 })
        }
      }
    }
  }
  return feedback
}

/**
 * The same walk over any edge list (class relationships use it too), given
 * the node ids in the order the walk starts from.
 */
export function findBackEdges(
  edges: ReadonlyArray<{ source: string; target: string }>,
  walkOrder: Iterable<string>,
): Set<number> {
  const outEdges = new Map<string, number[]>()
  edges.forEach((edge, index) => {
    if (edge.source === edge.target) return
    const list = outEdges.get(edge.source)
    if (list) list.push(index)
    else outEdges.set(edge.source, [index])
  })

  const back = new Set<number>()
  const visited = new Set<string>()
  const onStack = new Set<string>()

  // Iterative, so a long chain can't overflow the call stack.
  for (const root of walkOrder) {
    if (visited.has(root)) continue
    const stack: Array<{ node: string; next: number }> = [
      { node: root, next: 0 },
    ]
    visited.add(root)
    onStack.add(root)
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!
      const outs = outEdges.get(frame.node) ?? []
      if (frame.next >= outs.length) {
        onStack.delete(frame.node)
        stack.pop()
        continue
      }
      const index = outs[frame.next++]!
      const target = edges[index]!.target
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

/** Every node id in `sg`, including those of its nested subgraphs. */
export function subgraphMembers(sg: MermaidSubgraph): Set<string> {
  const out = new Set<string>(sg.nodeIds)
  for (const child of sg.children) {
    for (const id of subgraphMembers(child)) out.add(id)
  }
  return out
}

/**
 * Whether mermaid 12's ELK layout keeps two sibling subgraphs in declaration
 * order: an edge joins them, or a node outside both has an edge to each
 * (`E --> A`, `E --> C` into two subgraphs). Untied siblings are reversed.
 * Shared by the SVG compound layout and the ASCII grid (#2111).
 */
export function subgraphsTied(
  graph: MermaidGraph,
  a: MermaidSubgraph,
  b: MermaidSubgraph,
): boolean {
  const inA = subgraphMembers(a)
  const inB = subgraphMembers(b)
  const touches = (x: string, set: Set<string>): boolean =>
    graph.edges.some(
      (e) =>
        (e.source === x && set.has(e.target)) ||
        (e.target === x && set.has(e.source)),
    )
  return [...graph.nodes.keys()].some((x) =>
    inA.has(x) || inB.has(x)
      ? (inA.has(x) && touches(x, inB)) || (inB.has(x) && touches(x, inA))
      : touches(x, inA) && touches(x, inB),
  )
}
