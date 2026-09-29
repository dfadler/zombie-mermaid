import type {
  MermaidEdge,
  MermaidGraph,
  MermaidNode,
  MermaidSubgraph,
  NodeShape,
} from '@zombie-mermaid/core'
import type { C4Boundary, C4Diagram, C4Element } from './types.ts'

// ============================================================================
// C4 -> flowchart lowering
//
// C4 diagrams are boxes-and-arrows inside nested boundaries, which is
// exactly what the flowchart pipeline already lays out and draws (ELK for
// SVG, the grid router for ASCII), including nested subgraphs and labelled
// edges. Rather than maintaining a second layout engine, both renderers
// lower a parsed `C4Diagram` to a `MermaidGraph` and reuse that pipeline.
// The C4-specific look comes from the node labels (name / [type] /
// description), node shapes (person, database, queue) and `classDef`s.
// ============================================================================

const DESCRIPTION_WRAP = 32

/** Greedy word wrap; words longer than `width` stay on their own line. */
function wrap(text: string, width: number): string[] {
  const out: string[] = []
  for (const paragraph of text.split('\n')) {
    let cur = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (cur && cur.length + 1 + word.length > width) {
        out.push(cur)
        cur = word
      } else {
        cur = cur ? `${cur} ${word}` : word
      }
    }
    out.push(cur)
  }
  return out
}

function kindLabel(el: C4Element): string {
  const ext = el.external ? 'External ' : ''
  const suffix =
    el.shape === 'db' ? ' Database' : el.shape === 'queue' ? ' Queue' : ''
  switch (el.kind) {
    case 'person':
      return `${ext}Person`
    case 'system':
      return `${ext}System${suffix}`
    case 'container':
      return `${ext}Container${suffix}${el.technology ? `: ${el.technology}` : ''}`
    case 'component':
      return `${ext}Component${suffix}${el.technology ? `: ${el.technology}` : ''}`
  }
}

function elementLabel(el: C4Element): string {
  const lines = [el.label, `[${kindLabel(el)}]`]
  if (el.description) lines.push('', ...wrap(el.description, DESCRIPTION_WRAP))
  return lines.join('\n')
}

function elementShape(el: C4Element): NodeShape {
  if (el.shape === 'db') return 'cylinder'
  if (el.shape === 'queue') return 'stadium'
  return el.kind === 'person' ? 'rounded' : 'rectangle'
}

function elementClass(el: C4Element): string {
  if (el.external) return 'c4External'
  return el.kind === 'person' ? 'c4Person' : 'c4Element'
}

function boundaryLabel(b: C4Boundary): string {
  const lines = [b.label]
  if (b.type) lines.push(`[${b.type}]`)
  return lines.join('\n')
}

/** Standard C4 palette (Simon Brown / c4model.com). */
const CLASS_DEFS: Record<string, Record<string, string>> = {
  c4Person: { fill: '#08427b', stroke: '#052e56', color: '#ffffff' },
  c4Element: { fill: '#1168bd', stroke: '#0b4884', color: '#ffffff' },
  c4External: { fill: '#999999', stroke: '#6b6b6b', color: '#ffffff' },
}

/**
 * Lower a parsed C4 diagram to the flowchart model. Element and boundary
 * aliases become node/subgraph ids unchanged. A boundary/deployment node
 * with no contents (declared without a `{ }` block, or an empty one) is
 * lowered to a plain box, since an empty subgraph has nothing to lay out.
 */
export function c4ToGraph(diagram: C4Diagram): MermaidGraph {
  const nodes = new Map<string, MermaidNode>()
  const classAssignments = new Map<string, string>()
  const boundaryAliases = new Set<string>()

  for (const el of diagram.elements) {
    nodes.set(el.alias, {
      id: el.alias,
      label: elementLabel(el),
      shape: elementShape(el),
    })
    classAssignments.set(el.alias, elementClass(el))
  }

  const lowerBoundary = (b: C4Boundary): MermaidSubgraph | null => {
    const children = b.children
      .map(lowerBoundary)
      .filter((c): c is MermaidSubgraph => c !== null)
    if (b.elementAliases.length === 0 && children.length === 0) {
      // Empty boundary: draw it as a plain box so it (and any edges to it)
      // still appear.
      nodes.set(b.alias, {
        id: b.alias,
        label: boundaryLabel(b),
        shape: 'rectangle',
      })
      return null
    }
    boundaryAliases.add(b.alias)
    return {
      id: b.alias,
      label: boundaryLabel(b),
      nodeIds: [...b.elementAliases],
      children,
    }
  }

  const subgraphs = diagram.boundaries
    .map(lowerBoundary)
    .filter((s): s is MermaidSubgraph => s !== null)

  const edges: MermaidEdge[] = diagram.relationships.map((r) => {
    for (const end of [r.from, r.to]) {
      if (boundaryAliases.has(end)) {
        throw new Error(
          `C4 diagram: relationships to or from a boundary ("${end}") are not supported; connect the elements inside it instead`,
        )
      }
    }
    const parts: string[] = []
    if (r.index) parts.push(`${r.index}:`)
    if (r.label) parts.push(r.label)
    if (r.technology) parts.push(`[${r.technology}]`)
    const edge: MermaidEdge = {
      source: r.from,
      target: r.to,
      style: 'solid',
      hasArrowStart: r.bidirectional,
      hasArrowEnd: true,
    }
    if (parts.length > 0) edge.label = parts.join(' ')
    return edge
  })

  const usedClasses = new Set(classAssignments.values())
  const classDefs = new Map<string, Record<string, string>>()
  for (const name of usedClasses) classDefs.set(name, { ...CLASS_DEFS[name]! })

  return {
    direction: 'TB',
    nodes,
    edges,
    subgraphs,
    classDefs,
    classAssignments,
    nodeStyles: new Map(),
    linkStyles: new Map(),
    interactions: new Map(),
  }
}
