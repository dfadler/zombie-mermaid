import type {
  Direction,
  MermaidEdge,
  MermaidGraph,
  MermaidNode,
  MermaidSubgraph,
} from '@zombie-mermaid/core'
import type { UsecaseDiagram } from './types.ts'

/** The node id of the note drawn for `note for <target>`, the nth in the source. */
export const usecaseNoteId = (n: number): string => `note-${n}`

/**
 * Lower a use case diagram to the flowchart model, as mermaid does (its
 * `getData` hands the same nodes, edges and clusters to the dagre layout a
 * flowchart uses): actors, use cases and notes are nodes, a system boundary is
 * a subgraph, a note joins its target with a dotted line.
 */
export function usecaseToGraph(diagram: UsecaseDiagram): MermaidGraph {
  const nodes = new Map<string, MermaidNode>()
  for (const a of diagram.actors)
    nodes.set(a.id, { id: a.id, label: a.label, shape: 'usecase-actor' })
  for (const u of diagram.useCases)
    nodes.set(u.id, {
      id: u.id,
      label: u.label,
      shape: u.shape === 'rect' ? 'usecase-rect' : 'usecase-ellipse',
    })
  diagram.notes.forEach((note, i) =>
    nodes.set(usecaseNoteId(i), {
      id: usecaseNoteId(i),
      label: note.label,
      shape: 'usecase-note',
    }),
  )

  const edges: MermaidEdge[] = diagram.relationships.map((r) => {
    const dotted = r.type === 'include' || r.type === 'extend'
    return {
      source: r.source,
      target: r.target,
      style: dotted ? 'dotted' : 'solid',
      hasArrowStart: r.type === 'association' && r.arrow === 'backward',
      hasArrowEnd: r.type !== 'association' || r.arrow === 'forward',
      ...(r.type === 'generalization' && { endMarker: 'triangle' as const }),
      ...(dotted
        ? { label: `«${r.type}»` }
        : r.label !== undefined
          ? { label: r.label }
          : {}),
    }
  })
  diagram.notes.forEach((note, i) =>
    edges.push({
      source: usecaseNoteId(i),
      target: note.target,
      style: 'dotted',
      hasArrowStart: false,
      hasArrowEnd: false,
    }),
  )

  const subgraphs: MermaidSubgraph[] = diagram.boundaries.map((b) => ({
    id: b.id,
    label: b.label,
    nodeIds: [...b.members],
    children: [],
  }))

  return {
    direction: diagram.direction as Direction,
    nodes,
    edges,
    subgraphs,
    classDefs: new Map(),
    classAssignments: new Map(),
    nodeStyles: new Map(),
    linkStyles: new Map(),
    interactions: new Map(),
  }
}
