import type {
  Direction,
  MermaidEdge,
  MermaidGraph,
  MermaidNode,
  MermaidSubgraph,
} from '@zombie-mermaid/core'
import { parseStyleProps } from '@zombie-mermaid/core'
import type { UsecaseDiagram, UsecaseJson } from './types.ts'

const markerAt = (arrow: string, kind: 'circle' | 'cross') =>
  arrow.endsWith('Start') ? { startMarker: kind } : { endMarker: kind }

/** Separates a json row's key from its value in the node label. */
export const USECASE_JSON_SEP = '\u2063'

/** A json node's label: its name, then one `key<SEP>value` line per row (line breaks in a cell become spaces). */
export const usecaseJsonLabel = (j: UsecaseJson): string =>
  [
    j.id,
    ...j.rows.map((r) =>
      `${r.key}${USECASE_JSON_SEP}${r.value}`.replace(/[\r\n\t]+/g, ' '),
    ),
  ].join('\n')

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
  const classDefs = new Map<string, Record<string, string>>()
  for (const c of diagram.classDefs)
    classDefs.set(c.id, parseStyleProps(c.styles.join(',')))
  const classAssignments = new Map<string, string>()
  const nodeStyles = new Map<string, Record<string, string>>()
  // The stereotype is folded into the label, as «stereotype» above it.
  const labelOf = (e: { label: string; stereotype?: string }): string =>
    e.stereotype === undefined ? e.label : `«${e.stereotype}»\n${e.label}`
  const styled = (e: { id: string; classes?: string[]; styles?: string[] }) => {
    if (e.classes?.length) classAssignments.set(e.id, e.classes.at(-1)!)
    if (e.styles?.length)
      nodeStyles.set(e.id, parseStyleProps(e.styles.join(',')))
  }
  for (const a of diagram.actors) {
    styled(a)
    nodes.set(a.id, {
      id: a.id,
      label: labelOf(a),
      shape: a.type === undefined ? 'usecase-actor' : `usecase-actor-${a.type}`,
      ...(a.business && { business: true }),
    })
  }
  for (const u of diagram.useCases) {
    styled(u)
    nodes.set(u.id, {
      id: u.id,
      label: labelOf(u),
      shape: u.shape === 'rect' ? 'usecase-rect' : 'usecase-ellipse',
      ...(u.business && { business: true }),
    })
  }
  diagram.notes.forEach((note, i) =>
    nodes.set(usecaseNoteId(i), {
      id: usecaseNoteId(i),
      label: note.label,
      shape: 'usecase-note',
    }),
  )

  for (const j of diagram.jsonNodes) {
    styled(j)
    nodes.set(j.id, {
      id: j.id,
      label: usecaseJsonLabel(j),
      shape: 'usecase-json',
    })
  }

  const edges: MermaidEdge[] = diagram.relationships.map((r) => {
    const dotted = r.type === 'include' || r.type === 'extend'
    return {
      source: r.source,
      target: r.target,
      style: dotted ? 'dotted' : 'solid',
      hasArrowStart:
        r.type === 'association' &&
        (r.arrow === 'backward' || r.arrow.endsWith('Start')),
      hasArrowEnd:
        r.type !== 'association' ||
        r.arrow === 'forward' ||
        r.arrow.endsWith('End'),
      ...(r.type === 'generalization' && { endMarker: 'triangle' as const }),
      ...(r.arrow.startsWith('circle') && markerAt(r.arrow, 'circle')),
      ...(r.arrow.startsWith('cross') && markerAt(r.arrow, 'cross')),
      ...(r.id !== undefined && { id: r.id }),
      ...((r.animate !== undefined || r.animation !== undefined) && {
        animate: r.animate !== false,
      }),
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
    ...(b.type === 'package' && { package: true }),
  }))

  return {
    direction: diagram.direction as Direction,
    nodes,
    edges,
    subgraphs,
    classDefs,
    classAssignments,
    nodeStyles,
    linkStyles: new Map(),
    interactions: new Map(),
  }
}
