/**
 * Graph conversion: MermaidGraph → ELK JSON.
 *
 * Split out of layout-engine.ts. This module only handles building ELK's
 * nested JSON input format from a parsed MermaidGraph — the reverse
 * direction (ELK result → PositionedGraph) lives in ./from-elk.ts.
 */

import type { ElkNode, ElkExtendedEdge, LayoutOptions } from 'elkjs'
import type {
  MermaidGraph,
  MermaidSubgraph,
  MermaidEdge,
  RenderOptions,
} from '../types.ts'
import type { FontSizes } from '../styles.ts'
import { FONT_WEIGHTS, NODE_PADDING } from '../styles.ts'
import { measureMultilineText } from '../text-metrics.ts'
import { DEFAULTS } from './constants.ts'

/** Convert Mermaid direction to ELK direction */
function directionToElk(dir: MermaidGraph['direction']): string {
  switch (dir) {
    case 'LR':
      return 'RIGHT'
    case 'RL':
      return 'LEFT'
    case 'BT':
      return 'UP'
    case 'TD':
    case 'TB':
    default:
      return 'DOWN'
  }
}

// ============================================================================
// Node sizing (same logic as Dagre adapter)
// ============================================================================

function estimateNodeSize(
  id: string,
  label: string,
  shape: string,
  nodeLabelFontSize: number,
): { width: number; height: number } {
  const metrics = measureMultilineText(
    label,
    nodeLabelFontSize,
    FONT_WEIGHTS.nodeLabel,
  )

  let width = metrics.width + NODE_PADDING.horizontal * 2
  let height = metrics.height + NODE_PADDING.vertical * 2

  if (shape === 'diamond') {
    const side = Math.max(width, height) + NODE_PADDING.diamondExtra
    width = side
    height = side
  }

  if (shape === 'circle' || shape === 'doublecircle') {
    const diameter = Math.ceil(Math.sqrt(width * width + height * height)) + 8
    width = shape === 'doublecircle' ? diameter + 12 : diameter
    height = width
  }

  if (shape === 'hexagon') {
    width += NODE_PADDING.horizontal
  }

  if (shape === 'trapezoid' || shape === 'trapezoid-alt') {
    width += NODE_PADDING.horizontal
  }

  if (shape === 'asymmetric') {
    width += 12
  }

  if (shape === 'cylinder') {
    height += 14
  }

  if (shape === 'state-start' || shape === 'state-end') {
    return { width: 28, height: 28 }
  }

  width = Math.max(width, 60)
  height = Math.max(height, 36)

  return { width, height }
}

// ============================================================================
// Graph conversion: MermaidGraph → ELK JSON
// ============================================================================

export interface ElkGraphNode extends ElkNode {
  children?: ElkGraphNode[]
  edges?: ElkExtendedEdge[]
}

/**
 * Convert a MermaidGraph to ELK's nested JSON input format.
 *
 * Uses SEPARATE hierarchy handling for proper subgraph direction override support.
 * Cross-hierarchy edges use hierarchical ports to connect external and internal sections.
 */
export function mermaidToElk(
  graph: MermaidGraph,
  opts: Required<
    Pick<RenderOptions, 'font' | 'padding' | 'nodeSpacing' | 'layerSpacing'>
  > & { fontSizes: FontSizes },
): ElkGraphNode {
  // Collect all node IDs that belong to subgraphs
  const subgraphNodeIds = new Set<string>()
  const subgraphIds = new Set<string>()
  for (const sg of graph.subgraphs) {
    subgraphIds.add(sg.id)
    collectSubgraphNodeIds(sg, subgraphNodeIds, subgraphIds)
  }

  // Build node-to-subgraph mapping for edge distribution
  const nodeToSubgraph = buildNodeToSubgraphMap(graph.subgraphs)

  // Classify edges into three categories:
  // 1. Internal edges (both endpoints in same subgraph)
  // 2. Root-level edges (neither endpoint in a subgraph)
  // 3. Cross-hierarchy edges (endpoints in different levels)
  const edgesBySubgraph = new Map<
    string | null,
    Array<{ index: number; edge: (typeof graph.edges)[0] }>
  >()
  edgesBySubgraph.set(null, []) // Root-level edges

  // Track cross-hierarchy edges for hierarchical port creation
  const crossHierarchyEdges: Array<{
    index: number
    edge: (typeof graph.edges)[0]
    sourceSubgraph: string | undefined
    targetSubgraph: string | undefined
  }> = []

  for (let i = 0; i < graph.edges.length; i++) {
    const edge = graph.edges[i]!
    const sourceSubgraph = nodeToSubgraph.get(edge.source)
    const targetSubgraph = nodeToSubgraph.get(edge.target)

    if (sourceSubgraph && sourceSubgraph === targetSubgraph) {
      // Internal edge: both endpoints in same subgraph
      if (!edgesBySubgraph.has(sourceSubgraph)) {
        edgesBySubgraph.set(sourceSubgraph, [])
      }
      edgesBySubgraph.get(sourceSubgraph)!.push({ index: i, edge })
    } else if (!sourceSubgraph && !targetSubgraph) {
      // Root-level edge: neither endpoint in a subgraph
      edgesBySubgraph.get(null)!.push({ index: i, edge })
    } else {
      // Cross-hierarchy edge: need hierarchical ports
      crossHierarchyEdges.push({
        index: i,
        edge,
        sourceSubgraph,
        targetSubgraph,
      })
    }
  }

  // Determine if we need SEPARATE hierarchy handling
  // We use SEPARATE when any subgraph has a direction override
  const hasDirectionOverride = graph.subgraphs.some(
    (sg) => sg.direction !== undefined,
  )

  // Build the root ELK graph
  const elkGraph: ElkGraphNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': directionToElk(graph.direction),
      'elk.spacing.nodeNode': String(opts.nodeSpacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(opts.layerSpacing),
      'elk.spacing.edgeEdge': '12',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '12',
      'elk.layered.spacing.edgeNodeBetweenLayers': '12',
      'elk.padding': `[top=${opts.padding},left=${opts.padding},bottom=${opts.padding},right=${opts.padding}]`,
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
      'elk.contentAlignment': 'H_CENTER V_CENTER',
      'elk.layered.thoroughness': String(DEFAULTS.thoroughness),
      'elk.layered.highDegreeNodes.treatment': 'true',
      'elk.layered.highDegreeNodes.threshold': '8',
      'elk.layered.compaction.postCompaction.strategy':
        'LEFT_RIGHT_CONSTRAINT_LOCKING',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.wrapping.strategy': 'OFF',
      // Use SEPARATE when subgraphs have direction overrides (enables proper direction handling)
      // Use INCLUDE_CHILDREN otherwise (simpler cross-hierarchy edge routing)
      'elk.hierarchyHandling': hasDirectionOverride
        ? 'SEPARATE'
        : 'INCLUDE_CHILDREN',
    },
    children: [],
    edges: [],
  }

  // Track hierarchical ports per subgraph for cross-hierarchy edges
  const subgraphPorts = new Map<
    string,
    Array<{
      portId: string
      edgeIndex: number
      direction: 'incoming' | 'outgoing'
      internalNodeId: string
    }>
  >()

  // Process cross-hierarchy edges to create port entries
  if (hasDirectionOverride) {
    for (const {
      index,
      edge,
      sourceSubgraph,
      targetSubgraph,
    } of crossHierarchyEdges) {
      // Handle outgoing edges from subgraph
      if (sourceSubgraph) {
        const portId = `${sourceSubgraph}_out_${index}`
        if (!subgraphPorts.has(sourceSubgraph)) {
          subgraphPorts.set(sourceSubgraph, [])
        }
        subgraphPorts.get(sourceSubgraph)!.push({
          portId,
          edgeIndex: index,
          direction: 'outgoing',
          internalNodeId: edge.source,
        })
      }

      // Handle incoming edges to subgraph
      if (targetSubgraph) {
        const portId = `${targetSubgraph}_in_${index}`
        if (!subgraphPorts.has(targetSubgraph)) {
          subgraphPorts.set(targetSubgraph, [])
        }
        subgraphPorts.get(targetSubgraph)!.push({
          portId,
          edgeIndex: index,
          direction: 'incoming',
          internalNodeId: edge.target,
        })
      }
    }
  }

  // Add top-level nodes (those not in any subgraph)
  for (const [id, node] of graph.nodes) {
    if (!subgraphNodeIds.has(id) && !subgraphIds.has(id)) {
      const size = estimateNodeSize(
        id,
        node.label,
        node.shape,
        opts.fontSizes.nodeLabel,
      )
      elkGraph.children!.push({
        id,
        width: size.width,
        height: size.height,
        labels: [{ text: node.label }],
      })
    }
  }

  // Add subgraphs as compound nodes with children and their internal edges
  for (const sg of graph.subgraphs) {
    elkGraph.children!.push(
      subgraphToElk(sg, graph, opts, edgesBySubgraph, subgraphPorts),
    )
  }

  // Add root-level edges
  for (const { index, edge } of edgesBySubgraph.get(null)!) {
    const elkEdge: ElkExtendedEdge = {
      id: `e${index}`,
      sources: [edge.source],
      targets: [edge.target],
    }
    if (edge.label) {
      const metrics = measureMultilineText(
        edge.label,
        opts.fontSizes.edgeLabel,
        FONT_WEIGHTS.edgeLabel,
      )
      elkEdge.labels = [
        {
          text: edge.label,
          width: metrics.width + 8,
          height: metrics.height + 6,
          layoutOptions: {
            'elk.edgeLabels.inline': 'true',
            'elk.edgeLabels.placement': 'CENTER',
          },
        },
      ]
    }
    elkGraph.edges!.push(elkEdge)
  }

  // Add cross-hierarchy edges (using ports when SEPARATE, direct when INCLUDE_CHILDREN)
  for (const {
    index,
    edge,
    sourceSubgraph,
    targetSubgraph,
  } of crossHierarchyEdges) {
    const elkEdge: ElkExtendedEdge = {
      id: `e${index}`,
      sources:
        hasDirectionOverride && sourceSubgraph
          ? [`${sourceSubgraph}_out_${index}`]
          : [edge.source],
      targets:
        hasDirectionOverride && targetSubgraph
          ? [`${targetSubgraph}_in_${index}`]
          : [edge.target],
    }
    if (edge.label) {
      const metrics = measureMultilineText(
        edge.label,
        opts.fontSizes.edgeLabel,
        FONT_WEIGHTS.edgeLabel,
      )
      elkEdge.labels = [
        {
          text: edge.label,
          width: metrics.width + 8,
          height: metrics.height + 6,
          layoutOptions: {
            'elk.edgeLabels.inline': 'true',
            'elk.edgeLabels.placement': 'CENTER',
          },
        },
      ]
    }
    elkGraph.edges!.push(elkEdge)
  }

  return elkGraph
}

/**
 * Convert a MermaidSubgraph to an ELK compound node.
 * Includes internal edges (edges where both endpoints are in this subgraph)
 * so that the subgraph's direction override is respected by ELK.
 *
 * When using SEPARATE hierarchy handling (for direction override support),
 * also adds hierarchical ports for cross-hierarchy edges.
 */
function subgraphToElk(
  sg: MermaidSubgraph,
  graph: MermaidGraph,
  opts: Required<
    Pick<RenderOptions, 'font' | 'padding' | 'nodeSpacing' | 'layerSpacing'>
  > & { fontSizes: FontSizes },
  edgesBySubgraph: Map<
    string | null,
    Array<{ index: number; edge: MermaidEdge }>
  >,
  subgraphPorts: Map<
    string,
    Array<{
      portId: string
      edgeIndex: number
      direction: 'incoming' | 'outgoing'
      internalNodeId: string
    }>
  >,
): ElkGraphNode {
  const layoutOptions: LayoutOptions = {
    'elk.algorithm': 'layered',
    'elk.padding': '[top=44,left=16,bottom=16,right=16]', // Top = headerHeight(28) + gap(16) to match bottom padding
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.contentAlignment': 'H_CENTER V_CENTER',
    'elk.spacing.edgeEdge': '12',
    'elk.layered.spacing.edgeEdgeBetweenLayers': '12',
    'elk.layered.spacing.edgeNodeBetweenLayers': '12',
    'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
    'elk.layered.spacing.nodeNodeBetweenLayers': String(opts.layerSpacing),
    'elk.spacing.nodeNode': String(opts.nodeSpacing),
  }

  // Apply direction override if specified
  if (sg.direction) {
    layoutOptions['elk.direction'] = directionToElk(sg.direction)
  }

  const elkNode: ElkGraphNode = {
    id: sg.id,
    layoutOptions,
    labels: sg.label ? [{ text: sg.label }] : undefined,
    children: [],
    edges: [],
  }

  // Add hierarchical ports for cross-hierarchy edges (when using SEPARATE)
  const ports = subgraphPorts.get(sg.id) ?? []
  if (ports.length > 0) {
    elkNode.ports = ports.map((p) => ({
      id: p.portId,
      // Port side is determined by ELK based on edge direction
    }))
  }

  // Add direct child nodes
  for (const nodeId of sg.nodeIds) {
    const node = graph.nodes.get(nodeId)
    if (node) {
      const size = estimateNodeSize(
        nodeId,
        node.label,
        node.shape,
        opts.fontSizes.nodeLabel,
      )
      elkNode.children!.push({
        id: nodeId,
        width: size.width,
        height: size.height,
        labels: [{ text: node.label }],
      })
    }
  }

  // Add nested subgraphs recursively
  for (const child of sg.children) {
    elkNode.children!.push(
      subgraphToElk(child, graph, opts, edgesBySubgraph, subgraphPorts),
    )
  }

  // Add internal edges (edges where both endpoints are in this subgraph)
  const internalEdges = edgesBySubgraph.get(sg.id) ?? []
  for (const { index, edge } of internalEdges) {
    const elkEdge: ElkExtendedEdge = {
      id: `e${index}`,
      sources: [edge.source],
      targets: [edge.target],
    }
    if (edge.label) {
      const metrics = measureMultilineText(
        edge.label,
        opts.fontSizes.edgeLabel,
        FONT_WEIGHTS.edgeLabel,
      )
      elkEdge.labels = [
        {
          text: edge.label,
          width: metrics.width + 8,
          height: metrics.height + 6,
          layoutOptions: {
            'elk.edgeLabels.inline': 'true',
            'elk.edgeLabels.placement': 'CENTER',
          },
        },
      ]
    }
    elkNode.edges!.push(elkEdge)
  }

  // Add internal edge segments for hierarchical ports (port → node or node → port)
  // These connect the boundary ports to actual internal nodes
  for (const port of ports) {
    const internalEdgeId = `e${port.edgeIndex}_internal`
    const elkEdge: ElkExtendedEdge =
      port.direction === 'incoming'
        ? {
            id: internalEdgeId,
            sources: [port.portId],
            targets: [port.internalNodeId],
          }
        : {
            id: internalEdgeId,
            sources: [port.internalNodeId],
            targets: [port.portId],
          }
    elkNode.edges!.push(elkEdge)
  }

  return elkNode
}

/** Recursively collect all node IDs that belong to any subgraph */
function collectSubgraphNodeIds(
  sg: MermaidSubgraph,
  nodeIds: Set<string>,
  subgraphIds: Set<string>,
): void {
  for (const id of sg.nodeIds) {
    nodeIds.add(id)
  }
  for (const child of sg.children) {
    subgraphIds.add(child.id)
    collectSubgraphNodeIds(child, nodeIds, subgraphIds)
  }
}

/**
 * Build a mapping from node ID to its containing subgraph ID.
 * For nested subgraphs, maps to the innermost containing subgraph.
 * Nodes not in any subgraph are not included in the map.
 */
function buildNodeToSubgraphMap(
  subgraphs: MermaidSubgraph[],
): Map<string, string> {
  const map = new Map<string, string>()

  function traverse(sg: MermaidSubgraph): void {
    // Map all direct child nodes to this subgraph
    for (const nodeId of sg.nodeIds) {
      map.set(nodeId, sg.id)
    }
    // Recursively process nested subgraphs (they override parent mapping)
    for (const child of sg.children) {
      traverse(child)
    }
  }

  for (const sg of subgraphs) {
    traverse(sg)
  }

  return map
}
