/**
 * Edge bundling — merge fan-out / fan-in edge paths into shared trunks.
 * Split out of layout-engine.ts as a self-contained post-processing pass
 * over a PositionedGraph's nodes/edges/groups.
 */

import type {
  PositionedEdge,
  PositionedNode,
  PositionedGroup,
  Direction,
  Point,
} from '../types.ts'

/*
 * Shrink applied to a node box before testing it against a bundled path, in px.
 * A trunk that merely grazes a node's border reads as clean, so only a genuine
 * overlap should disqualify a bundle.
 */
const NODE_CLEARANCE = 0.5

/**
 * True when every segment of `points` stays clear of all `nodes`, ignoring the
 * ones named in `skipIds` (an edge's own endpoints, which it must touch).
 *
 * Bundling replaces a routed path with a trunk plus a straight branch to each
 * target. That branch is only safe when it spans the gap between two adjacent
 * layers; a target further away makes it cross every layer in between — and
 * whatever nodes sit in them. The layout engine already routed those edges
 * around the obstacles, so a bundle that would collide is rejected and the
 * original routing kept.
 *
 * Paths here are rectilinear, so each segment is tested as a degenerate
 * rectangle against each node's box.
 */
function pathClearOfNodes(
  points: Point[],
  nodes: PositionedNode[],
  skipIds: Set<string>,
): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const segMinX = Math.min(a.x, b.x)
    const segMaxX = Math.max(a.x, b.x)
    const segMinY = Math.min(a.y, b.y)
    const segMaxY = Math.max(a.y, b.y)

    for (const node of nodes) {
      if (skipIds.has(node.id)) continue
      const minX = node.x + NODE_CLEARANCE
      const maxX = node.x + node.width - NODE_CLEARANCE
      const minY = node.y + NODE_CLEARANCE
      const maxY = node.y + node.height - NODE_CLEARANCE
      // A node smaller than the clearance on either axis can't block anything.
      if (minX >= maxX || minY >= maxY) continue
      if (
        segMinX < maxX &&
        segMaxX > minX &&
        segMinY < maxY &&
        segMaxY > minY
      ) {
        return false
      }
    }
  }
  return true
}

/**
 * Find all groups (outermost first) that geometrically contain the given point.
 */
function findGroupsContainingPoint(
  x: number,
  y: number,
  groups: PositionedGroup[],
): PositionedGroup[] {
  const result: PositionedGroup[] = []
  for (const g of groups) {
    if (x >= g.x && x <= g.x + g.width && y >= g.y && y <= g.y + g.height) {
      result.push(g)
      result.push(...findGroupsContainingPoint(x, y, g.children))
    }
  }
  return result
}

/**
 * If `junction` falls inside a group that doesn't contain the reference node,
 * move it just outside the outermost such group boundary.
 */
function adjustJunctionForGroups(
  junctionMain: number, // the junction coordinate along the flow axis (Y for TD, X for LR)
  refX: number, // reference node center X (for finding its groups)
  refY: number, // reference node center Y
  groups: PositionedGroup[],
  direction: Direction,
): number {
  const GAP = 12
  const isLR = direction === 'LR'
  const isRL = direction === 'RL'
  const isBT = direction === 'BT'
  const isHorizontal = isLR || isRL

  // Groups containing the reference node
  const refGroupIds = new Set(
    findGroupsContainingPoint(refX, refY, groups).map((g) => g.id),
  )

  // Check where the junction point would be along the trunk
  const probeX = isHorizontal ? junctionMain : refX
  const probeY = isHorizontal ? refY : junctionMain
  const junctionGroups = findGroupsContainingPoint(probeX, probeY, groups)

  // Find outermost group containing the junction but NOT the reference node
  const crossingGroup = junctionGroups.find((g) => !refGroupIds.has(g.id))
  if (!crossingGroup) return junctionMain

  // Move junction just outside this group
  if (isLR) return crossingGroup.x - GAP
  if (isRL) return crossingGroup.x + crossingGroup.width + GAP
  if (isBT) return crossingGroup.y + crossingGroup.height + GAP
  return crossingGroup.y - GAP // TD
}

/**
 * Bundle fan-out and fan-in edge paths so they share a common trunk segment.
 *
 * For fan-out (one source → N targets), all edges exit the source at the same
 * point, travel along a shared trunk, then branch to their individual targets.
 * The overlapping trunk segments render as a single visible line.
 *
 * Junction points are placed outside subgraph boundaries so branches split
 * before entering a group, not inside it.
 *
 * Constraints: edges in a bundle must share the same style and have no labels.
 * Self-loops and backward edges (against the graph direction) are excluded.
 */
export function bundleEdgePaths(
  edges: PositionedEdge[],
  nodes: PositionedNode[],
  groups: PositionedGroup[],
  direction: Direction,
): void {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const processed = new Set<PositionedEdge>()

  const isLR = direction === 'LR'
  const isRL = direction === 'RL'
  const isBT = direction === 'BT'
  const isHorizontal = isLR || isRL

  // --- Fan-out: group edges by shared source ---
  const fanOutGroups = new Map<string, PositionedEdge[]>()
  for (const edge of edges) {
    if (edge.source === edge.target) continue
    const group = fanOutGroups.get(edge.source) ?? []
    fanOutGroups.set(edge.source, group)
    group.push(edge)
  }

  for (const [sourceId, group] of fanOutGroups) {
    if (group.length < 2) continue

    const style = group[0]!.style
    if (group.some((e) => e.label || e.style !== style)) continue

    const source = nodeMap.get(sourceId)
    if (!source) continue

    // Only bundle edges going in the forward direction. Collects the
    // resolved target node alongside each edge as it filters, rather than
    // re-querying nodeMap afterward — the two lookups can't be proven to
    // agree from a map() over a separately-filtered array.
    const targets: { edge: PositionedEdge; node: PositionedNode }[] = []
    for (const e of group) {
      const t = nodeMap.get(e.target)
      if (!t) continue
      const isForward = isLR
        ? t.x > source.x + source.width
        : isRL
          ? t.x + t.width < source.x
          : isBT
            ? t.y + t.height < source.y
            : t.y > source.y + source.height // TD/TB
      if (isForward) targets.push({ edge: e, node: t })
    }
    if (targets.length < 2) continue

    const srcCX = source.x + source.width / 2
    const srcCY = source.y + source.height / 2

    if (isHorizontal) {
      const exitX = isLR ? source.x + source.width : source.x
      const exitY = srcCY

      const nearestX = isLR
        ? Math.min(...targets.map((t) => t.node.x))
        : Math.max(...targets.map((t) => t.node.x + t.node.width))
      let junctionX = exitX + (nearestX - exitX) / 2
      junctionX = adjustJunctionForGroups(
        junctionX,
        srcCX,
        srcCY,
        groups,
        direction,
      )

      const bundled: { edge: PositionedEdge; points: Point[] }[] = []
      for (const { edge, node: target } of targets) {
        const entryX = isLR ? target.x : target.x + target.width
        const entryY = target.y + target.height / 2
        const points = [
          { x: exitX, y: exitY },
          { x: junctionX, y: exitY },
          { x: junctionX, y: entryY },
          { x: entryX, y: entryY },
        ]
        if (pathClearOfNodes(points, nodes, new Set([sourceId, target.id]))) {
          bundled.push({ edge, points })
        }
      }
      // One clear branch is not a bundle — leave the whole group as routed.
      if (bundled.length < 2) continue
      for (const { edge, points } of bundled) {
        edge.points = points
        processed.add(edge)
      }
    } else {
      const exitX = srcCX
      const exitY = isBT ? source.y : source.y + source.height

      const nearestY = isBT
        ? Math.max(...targets.map((t) => t.node.y + t.node.height))
        : Math.min(...targets.map((t) => t.node.y))
      let junctionY = exitY + (nearestY - exitY) / 2
      junctionY = adjustJunctionForGroups(
        junctionY,
        srcCX,
        srcCY,
        groups,
        direction,
      )

      const bundled: { edge: PositionedEdge; points: Point[] }[] = []
      for (const { edge, node: target } of targets) {
        const entryX = target.x + target.width / 2
        const entryY = isBT ? target.y + target.height : target.y
        const points = [
          { x: exitX, y: exitY },
          { x: exitX, y: junctionY },
          { x: entryX, y: junctionY },
          { x: entryX, y: entryY },
        ]
        if (pathClearOfNodes(points, nodes, new Set([sourceId, target.id]))) {
          bundled.push({ edge, points })
        }
      }
      // One clear branch is not a bundle — leave the whole group as routed.
      if (bundled.length < 2) continue
      for (const { edge, points } of bundled) {
        edge.points = points
        processed.add(edge)
      }
    }
  }

  // --- Fan-in: group edges by shared target (skip already-bundled edges) ---
  const fanInGroups = new Map<string, PositionedEdge[]>()
  for (const edge of edges) {
    if (processed.has(edge) || edge.source === edge.target) continue
    const group = fanInGroups.get(edge.target) ?? []
    fanInGroups.set(edge.target, group)
    group.push(edge)
  }

  for (const [targetId, group] of fanInGroups) {
    if (group.length < 2) continue

    const style = group[0]!.style
    if (group.some((e) => e.label || e.style !== style)) continue

    const target = nodeMap.get(targetId)
    if (!target) continue

    // Collects the resolved source node alongside each edge as it filters,
    // rather than re-querying nodeMap afterward (see the fan-out loop above
    // for why: a map() over a separately-filtered array can't be proven to
    // agree with the filter's own lookup).
    const sources: { edge: PositionedEdge; node: PositionedNode }[] = []
    for (const e of group) {
      const s = nodeMap.get(e.source)
      if (!s) continue
      const isForward = isLR
        ? s.x + s.width < target.x
        : isRL
          ? s.x > target.x + target.width
          : isBT
            ? s.y > target.y + target.height
            : s.y + s.height < target.y // TD/TB
      if (isForward) sources.push({ edge: e, node: s })
    }
    if (sources.length < 2) continue
    const tgtCX = target.x + target.width / 2
    const tgtCY = target.y + target.height / 2

    if (isHorizontal) {
      const entryX = isLR ? target.x : target.x + target.width
      const entryY = tgtCY

      const farthestX = isLR
        ? Math.max(...sources.map((s) => s.node.x + s.node.width))
        : Math.min(...sources.map((s) => s.node.x))
      let junctionX = farthestX + (entryX - farthestX) / 2
      junctionX = adjustJunctionForGroups(
        junctionX,
        tgtCX,
        tgtCY,
        groups,
        direction,
      )

      const bundled: { edge: PositionedEdge; points: Point[] }[] = []
      for (const { edge, node: src } of sources) {
        const exitX = isLR ? src.x + src.width : src.x
        const exitY = src.y + src.height / 2
        const points = [
          { x: exitX, y: exitY },
          { x: junctionX, y: exitY },
          { x: junctionX, y: entryY },
          { x: entryX, y: entryY },
        ]
        if (pathClearOfNodes(points, nodes, new Set([src.id, targetId]))) {
          bundled.push({ edge, points })
        }
      }
      // One clear branch is not a bundle — leave the whole group as routed.
      if (bundled.length < 2) continue
      for (const { edge, points } of bundled) {
        edge.points = points
      }
    } else {
      const entryX = tgtCX
      const entryY = isBT ? target.y + target.height : target.y

      const farthestY = isBT
        ? Math.min(...sources.map((s) => s.node.y))
        : Math.max(...sources.map((s) => s.node.y + s.node.height))
      let junctionY = farthestY + (entryY - farthestY) / 2
      junctionY = adjustJunctionForGroups(
        junctionY,
        tgtCX,
        tgtCY,
        groups,
        direction,
      )

      const bundled: { edge: PositionedEdge; points: Point[] }[] = []
      for (const { edge, node: src } of sources) {
        const exitX = src.x + src.width / 2
        const exitY = isBT ? src.y : src.y + src.height
        const points = [
          { x: exitX, y: exitY },
          { x: exitX, y: junctionY },
          { x: entryX, y: junctionY },
          { x: entryX, y: entryY },
        ]
        if (pathClearOfNodes(points, nodes, new Set([src.id, targetId]))) {
          bundled.push({ edge, points })
        }
      }
      // One clear branch is not a bundle — leave the whole group as routed.
      if (bundled.length < 2) continue
      for (const { edge, points } of bundled) {
        edge.points = points
      }
    }
  }
}
