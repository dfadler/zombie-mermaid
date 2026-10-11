/**
 * Our own layout of a diagram as node/group boxes, for scripts/layout-oracle.ts.
 * Browser-free, so it can be unit-tested.
 */

import { splitStatements } from '@zombie-mermaid/core'
import {
  parseClassDiagram,
  parseErDiagram,
} from '@zombie-mermaid/mermaid-parser'
import {
  layoutClassDiagramSync,
  layoutErDiagramSync,
  layoutFlowchartSync,
  layoutGraphSync,
} from '@zombie-mermaid/svg-renderer'
import { parseMermaid } from '../../src/index.ts'
import type { Box, LayoutBoxes, OracleType } from './layout-agreement.ts'

/** Box of every node and subgraph in our own layout of `source`. */
export function measureOurs(source: string, type: OracleType): LayoutBoxes {
  const nodes: Record<string, Box> = {}
  if (type === 'class') {
    const d = layoutClassDiagramSync(parseClassDiagram(splitStatements(source)))
    for (const c of d.classes) {
      nodes[c.id] = { x: c.x, y: c.y, w: c.width, h: c.height }
    }
    const groups: Record<string, Box> = {}
    for (const n of d.namespaces) {
      groups[n.name] = { x: n.x, y: n.y, w: n.width, h: n.height }
    }
    return { nodes, groups }
  }
  if (type === 'er') {
    const d = layoutErDiagramSync(parseErDiagram(splitStatements(source)))
    for (const e of d.entities) {
      nodes[e.id] = { x: e.x, y: e.y, w: e.width, h: e.height }
    }
    return { nodes, groups: {} }
  }
  const graph = parseMermaid(source)
  const positioned =
    type === 'state' ? layoutGraphSync(graph) : layoutFlowchartSync(graph)
  for (const n of positioned.nodes) {
    nodes[n.id] = { x: n.x, y: n.y, w: n.width, h: n.height }
  }
  const groups: Record<string, Box> = {}
  const walk = (list: typeof positioned.groups): void => {
    for (const g of list) {
      groups[g.id] = { x: g.x, y: g.y, w: g.width, h: g.height }
      walk(g.children)
    }
  }
  walk(positioned.groups)
  return { nodes, groups }
}
