import type {
  Direction,
  MermaidEdge,
  MermaidGraph,
  MermaidNode,
  MermaidSubgraph,
  NodeShape,
} from '@zombie-mermaid/core'
import type {
  ArchitectureDiagram,
  ArchitectureEdge,
  ArchitecturePort,
} from './types.ts'

// ============================================================================
// Architecture -> flowchart lowering
//
// `architecture-beta` is boxes in nested boxes joined by edges, which the
// flowchart pipeline already lays out and draws (ELK for SVG, the grid router
// for ASCII). Like the other lowered types it becomes a `MermaidGraph`:
//
//   group          -> subgraph (nested via `in`)
//   service        -> node; the icon picks a shape
//   junction       -> small filled circle, no label
//   edge           -> edge; `<`/`>` become arrowheads
//   `{group}` end  -> the edge attaches to the service's enclosing group
//
// What is not carried over: Mermaid places services on a grid from the edge
// ports, so `a:R -- L:b` means "b is right of a". Here ports only choose the
// flow direction (majority axis) and which way each edge points in the
// layout; exact placement is the flowchart layout's. The SVG renderer draws
// an icon tile per service (`icon`, #2518); ASCII only has the shape. `align`
// is ignored.
// ============================================================================

/** Built-in Mermaid icons that have a distinct flowchart shape. */
const ICON_SHAPE: Record<string, NodeShape> = {
  database: 'cylinder',
  disk: 'cylinder',
  cloud: 'stadium',
  internet: 'circle',
}

const HORIZONTAL: ReadonlySet<ArchitecturePort> = new Set(['L', 'R'])

/** Flow direction: vertical only when more edges leave via T/B than L/R. */
function pickDirection(edges: readonly ArchitectureEdge[]): Direction {
  let horizontal = 0
  let vertical = 0
  for (const e of edges) {
    for (const p of [e.sourcePort, e.targetPort]) {
      if (HORIZONTAL.has(p)) horizontal++
      else vertical++
    }
  }
  return vertical > horizontal ? 'TB' : 'LR'
}

/**
 * Whether the edge, as written, runs against the layout flow. `a:L -- R:b`
 * puts `a` to the right of `b`, so in a left-to-right layout the edge has to
 * be emitted reversed for `a` to land on the right.
 */
function runsBackwards(e: ArchitectureEdge, direction: Direction): boolean {
  const horizontal = direction === 'LR' || direction === 'RL'
  const [back, forward]: ArchitecturePort[] = horizontal
    ? ['L', 'R']
    : ['T', 'B']
  // Source port on the far side of the flow, or target port on the near side.
  if (e.sourcePort === forward || e.targetPort === back) return false
  return e.sourcePort === back || e.targetPort === forward
}

const STEP: Record<ArchitecturePort, [number, number]> = {
  L: [-1, 0],
  R: [1, 0],
  T: [0, -1],
  B: [0, 1],
}

/**
 * Grid cell of every service and junction, as Mermaid works it out before
 * placing them: walk the edges from each unplaced node, one cell per port
 * (`a:R -- L:b` puts `b` one cell right of `a`). The first cell a node gets
 * wins when a cycle disagrees.
 */
function gridCells(
  diagram: ArchitectureDiagram,
): Map<string, [number, number]> {
  const cells = new Map<string, [number, number]>()
  const links = new Map<string, Array<[string, [number, number]]>>()
  const link = (from: string, to: string, [dx, dy]: [number, number]): void => {
    links.set(from, [...(links.get(from) ?? []), [to, [dx, dy]]])
  }
  for (const e of diagram.edges) {
    link(e.source, e.target, STEP[e.sourcePort])
    const [dx, dy] = STEP[e.targetPort]
    link(e.target, e.source, [dx, dy])
  }
  const ids = [...diagram.services, ...diagram.junctions].map((n) => n.id)
  for (const seed of ids) {
    if (cells.has(seed)) continue
    cells.set(seed, [0, 0])
    const queue = [seed]
    for (const id of queue) {
      const [x, y] = cells.get(id)!
      for (const [to, [dx, dy]] of links.get(id) ?? []) {
        if (cells.has(to)) continue
        cells.set(to, [x + dx, y + dy])
        queue.push(to)
      }
    }
  }
  return cells
}

export function architectureToGraph(
  diagram: ArchitectureDiagram,
): MermaidGraph {
  const nodes = new Map<string, MermaidNode>()
  const parentOf = new Map<string, string | undefined>()

  for (const s of diagram.services) {
    nodes.set(s.id, {
      id: s.id,
      label: s.title,
      shape: (s.icon && ICON_SHAPE[s.icon]) || 'rectangle',
      icon: s.icon ?? '',
    })
    parentOf.set(s.id, s.parent)
  }
  for (const j of diagram.junctions) {
    nodes.set(j.id, { id: j.id, label: '', shape: 'filled-circle' })
    parentOf.set(j.id, j.parent)
  }

  // Subgraphs, nested. Children are attached in declaration order.
  const subgraphs = new Map<string, MermaidSubgraph>()
  for (const g of diagram.groups) {
    subgraphs.set(g.id, {
      id: g.id,
      label: g.title,
      nodeIds: [],
      children: [],
    })
  }
  const roots: MermaidSubgraph[] = []
  for (const g of diagram.groups) {
    const sg = subgraphs.get(g.id)!
    const parent = g.parent ? subgraphs.get(g.parent) : undefined
    if (parent) parent.children.push(sg)
    else roots.push(sg)
  }
  for (const [id, parent] of parentOf) {
    subgraphs.get(parent ?? '')?.nodeIds.push(id)
  }

  const direction = pickDirection(diagram.edges)
  const cells = gridCells(diagram)
  const axis = direction === 'TB' ? 1 : 0
  for (const [id, cell] of cells) {
    Object.assign(nodes.get(id)!, {
      gridLayer: cell[axis],
      gridOrder: cell[1 - axis],
    })
  }
  const edges: MermaidEdge[] = diagram.edges.map((e) => {
    const end = (id: string, viaGroup: boolean): string =>
      (viaGroup ? parentOf.get(id) : undefined) ?? id
    const forward = !runsBackwards(e, direction)
    const [source, target] = forward
      ? [end(e.source, e.sourceGroup), end(e.target, e.targetGroup)]
      : [end(e.target, e.targetGroup), end(e.source, e.sourceGroup)]
    const across =
      !HORIZONTAL.has(e.sourcePort) === (axis === 0) &&
      cells.get(e.source)![axis] === cells.get(e.target)![axis]
    return {
      source,
      target,
      ...(across &&
      parentOf.get(e.source) === undefined &&
      parentOf.get(e.target) === undefined &&
      e.source !== e.target &&
      !e.sourceGroup &&
      !e.targetGroup
        ? { acrossFlow: true }
        : {}),
      style: 'solid',
      hasArrowStart: forward ? e.arrowStart : e.arrowEnd,
      hasArrowEnd: forward ? e.arrowEnd : e.arrowStart,
    }
  })

  return {
    direction,
    nodes,
    edges,
    subgraphs: roots,
    classDefs: new Map(),
    classAssignments: new Map(),
    nodeStyles: new Map(),
    linkStyles: new Map(),
    interactions: new Map(),
  }
}
