/**
 * Class diagram layout engine (ELK.js).
 *
 * Each class box has 3 compartments:
 *   1. Header (class name + optional annotation)
 *   2. Attributes section
 *   3. Methods section
 */

import type { ElkNode, ElkExtendedEdge } from 'elkjs'
import type {
  ClassDiagram,
  ClassNode,
  ClassMember,
  PositionedClassDiagram,
  PositionedClassNode,
  PositionedClassNote,
  PositionedClassRelationship,
} from './types.ts'
import { formatClassMember } from './format.ts'
import type { RenderOptions } from '../types.ts'
import {
  estimateTextWidth,
  estimateMonoTextWidth,
  FONT_WEIGHTS,
  resolveFontSizes,
} from '../styles.ts'
import { measureMultilineText } from '../text-metrics.ts'
import { elkLayoutSync } from '../elk-instance.ts'
import { resolveNodeStyle } from '../style-directives.ts'
import {
  extractEdgePoints,
  extractEdgeLabelPosition,
} from '../layout-engine/elk-adapter-utils.ts'

/** Layout constants for class diagrams */
export const CLS = {
  padding: 40,
  boxPadX: 8,
  headerBaseHeight: 32,
  annotationHeight: 16,
  memberRowHeight: 20,
  sectionPadY: 8,
  emptySectionHeight: 8,
  minWidth: 120,
  memberFontSize: 11,
  memberFontWeight: 400,
  nodeSpacing: 40,
  layerSpacing: 60,
  /** Horizontal / vertical padding inside a note box, around its text */
  notePadX: 10,
  notePadY: 6,
} as const

/**
 * Layout id for the i-th note. A class id is a run of non-whitespace
 * (`\S+` in the parser), so an id containing a space can never collide
 * with one; ELK treats ids as opaque strings.
 */
export function classNoteId(index: number): string {
  return `note ${index}`
}

/** Layout id for the dotted link joining note `noteId` to its class. */
function classNoteLinkId(noteId: string): string {
  return `${noteId} link`
}

type ClassSizeMap = Map<
  string,
  {
    width: number
    height: number
    headerHeight: number
    attrHeight: number
    methodHeight: number
  }
>

/** Size of each note box, keyed by its layout id. */
type NoteSizeMap = Map<string, { width: number; height: number }>

/** Build ELK graph and size map from a class diagram. */
function buildClassElkGraph(
  diagram: ClassDiagram,
  options: RenderOptions,
): { elkGraph: ElkNode; classSizes: ClassSizeMap; noteSizes: NoteSizeMap } {
  const classSizes: ClassSizeMap = new Map()
  const noteSizes: NoteSizeMap = new Map()
  const fontSizes = resolveFontSizes(options.fontSizes)

  for (const cls of diagram.classes) {
    const headerHeight = cls.annotation
      ? CLS.headerBaseHeight + CLS.annotationHeight
      : CLS.headerBaseHeight

    const attrHeight =
      cls.attributes.length > 0
        ? cls.attributes.length * CLS.memberRowHeight + CLS.sectionPadY
        : CLS.emptySectionHeight

    const methodHeight =
      cls.methods.length > 0
        ? cls.methods.length * CLS.memberRowHeight + CLS.sectionPadY
        : CLS.emptySectionHeight

    const headerTextW = estimateTextWidth(
      cls.label,
      fontSizes.nodeLabel,
      FONT_WEIGHTS.nodeLabel,
    )
    const maxAttrW = maxMemberWidth(cls.attributes)
    const maxMethodW = maxMemberWidth(cls.methods)
    const width = Math.max(
      CLS.minWidth,
      headerTextW + CLS.boxPadX * 2,
      maxAttrW + CLS.boxPadX * 2,
      maxMethodW + CLS.boxPadX * 2,
    )
    const height = headerHeight + attrHeight + methodHeight

    classSizes.set(cls.id, {
      width,
      height,
      headerHeight,
      attrHeight,
      methodHeight,
    })
  }

  // Iterate classSizes directly (populated above, in diagram.classes order)
  // rather than looking each class back up by id — sidesteps needing an
  // assertion or invariant check for a lookup that can't actually miss.
  const children: ElkNode[] = []
  for (const [id, size] of classSizes) {
    children.push({ id, width: size.width, height: size.height })
  }

  const edges: ElkExtendedEdge[] = []
  for (const [i, rel] of diagram.relationships.entries()) {
    const edge: ElkExtendedEdge = {
      id: `e${i}`,
      sources: [rel.from],
      targets: [rel.to],
    }
    if (rel.label) {
      const metrics = measureMultilineText(
        rel.label,
        fontSizes.edgeLabel,
        FONT_WEIGHTS.edgeLabel,
      )
      edge.labels = [
        {
          text: rel.label,
          width: metrics.width + 8,
          height: metrics.height + 6,
        },
      ]
    }
    edges.push(edge)
  }

  // Notes. Mirrors Mermaid's classDb.getData(): every note is a node of its
  // own, and `note for X` adds an arrowless dotted edge note→class so the
  // layout keeps the two adjacent (with a DOWN layout the note lands above
  // its class, as it does in Mermaid's TB rendering). The link edges go
  // after the relationship edges so relationship indices stay positional.
  const classIds = new Set(classSizes.keys())
  for (const [i, note] of diagram.notes.entries()) {
    const id = classNoteId(i)
    const metrics = measureMultilineText(
      note.text,
      fontSizes.edgeLabel,
      FONT_WEIGHTS.edgeLabel,
    )
    const size = {
      width: metrics.width + CLS.notePadX * 2,
      height: metrics.height + CLS.notePadY * 2,
    }
    noteSizes.set(id, size)
    children.push({ id, width: size.width, height: size.height })
    if (note.forClass !== undefined && classIds.has(note.forClass)) {
      edges.push({
        id: classNoteLinkId(id),
        sources: [id],
        targets: [note.forClass],
      })
    }
  }

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': String(CLS.nodeSpacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(CLS.layerSpacing),
      'elk.padding': `[top=${CLS.padding},left=${CLS.padding},bottom=${CLS.padding},right=${CLS.padding}]`,
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.edgeLabels.placement': 'CENTER',
    },
    children,
    edges,
  }

  return { elkGraph, classSizes, noteSizes }
}

/** Extract positioned classes, relationships, and notes from ELK result. */
function extractClassLayout(
  result: ElkNode,
  diagram: ClassDiagram,
  classSizes: ClassSizeMap,
  noteSizes: NoteSizeMap,
): PositionedClassDiagram {
  const classLookup = new Map<string, ClassNode>()
  for (const cls of diagram.classes) classLookup.set(cls.id, cls)

  const positionedClasses: PositionedClassNode[] = []
  for (const child of result.children ?? []) {
    const cls = classLookup.get(child.id)
    if (cls) {
      const size = classSizes.get(cls.id)
      if (!size) {
        // Unreachable — classSizes is populated for every diagram.classes
        // entry, and classLookup/cls.id come from that same list.
        /* v8 ignore next */
        throw new Error(`Missing computed size for class "${cls.id}"`)
      }
      positionedClasses.push({
        id: cls.id,
        label: cls.label,
        annotation: cls.annotation,
        attributes: cls.attributes,
        methods: cls.methods,
        x: child.x ?? 0,
        y: child.y ?? 0,
        width: child.width ?? size.width,
        height: child.height ?? size.height,
        headerHeight: size.headerHeight,
        attrHeight: size.attrHeight,
        methodHeight: size.methodHeight,
        interaction: diagram.interactions.get(cls.id),
        // Same cascade the flowchart layout applies (src/layout-engine/
        // from-elk.ts): classDef default → assigned class → `style`.
        inlineStyle: resolveNodeStyle(cls.id, diagram),
        // Kept separately from inlineStyle so the class name still reaches
        // the SVG `class` attribute when it has no matching classDef.
        className: diagram.classAssignments.get(cls.id),
      })
    }
  }

  const relationships: PositionedClassRelationship[] = []
  const elkEdges = result.edges ?? []
  // The first diagram.relationships.length edges are the relationships, in
  // order — buildClassElkGraph creates exactly one ELK edge per relationship
  // before appending any note links.
  for (const [i, rel] of diagram.relationships.entries()) {
    const elkEdge = elkEdges[i]
    if (!elkEdge) {
      // Unreachable — ELK returns every edge it was given.
      /* v8 ignore next */
      throw new Error(`Missing ELK edge for relationship ${i}`)
    }

    const points = extractEdgePoints(elkEdge)
    const labelPosition = extractEdgeLabelPosition(elkEdge)

    relationships.push({
      from: rel.from,
      to: rel.to,
      type: rel.type,
      markerAt: rel.markerAt,
      label: rel.label,
      fromCardinality: rel.fromCardinality,
      toCardinality: rel.toCardinality,
      points,
      labelPosition,
    })
  }

  // Note links are matched by id rather than position — only notes whose
  // class exists got an edge, so their count isn't derivable from the note list.
  const linkEdges = new Map<string, ElkExtendedEdge>()
  for (const elkEdge of elkEdges.slice(diagram.relationships.length)) {
    linkEdges.set(elkEdge.id, elkEdge)
  }
  const childById = new Map<string, ElkNode>()
  for (const child of result.children ?? []) childById.set(child.id, child)

  const notes: PositionedClassNote[] = []
  for (const [i, note] of diagram.notes.entries()) {
    const id = classNoteId(i)
    const child = childById.get(id)
    const size = noteSizes.get(id)
    if (!child || !size) {
      // Unreachable — a child and a size are recorded for every note.
      /* v8 ignore next */
      throw new Error(`Missing layout for note ${i}`)
    }
    const link = linkEdges.get(classNoteLinkId(id))
    notes.push({
      id,
      text: note.text,
      ...(link && note.forClass !== undefined
        ? { forClass: note.forClass }
        : {}),
      x: child.x ?? 0,
      y: child.y ?? 0,
      width: child.width ?? size.width,
      height: child.height ?? size.height,
      ...(link ? { linkPoints: extractEdgePoints(link) } : {}),
    })
  }

  return {
    width: result.width ?? 600,
    height: result.height ?? 400,
    classes: positionedClasses,
    relationships,
    notes,
  }
}

/**
 * Lay out a parsed class diagram using ELK.js (synchronous).
 */
export function layoutClassDiagramSync(
  diagram: ClassDiagram,
  options: RenderOptions = {},
): PositionedClassDiagram {
  if (diagram.classes.length === 0 && diagram.notes.length === 0) {
    return { width: 0, height: 0, classes: [], relationships: [], notes: [] }
  }

  const { elkGraph, classSizes, noteSizes } = buildClassElkGraph(
    diagram,
    options,
  )
  const result = elkLayoutSync(elkGraph, options.layoutCache)
  return extractClassLayout(result, diagram, classSizes, noteSizes)
}

/** Calculate the max width of a list of class members (uses mono metrics) */
function maxMemberWidth(members: ClassMember[]): number {
  if (members.length === 0) return 0
  let maxW = 0
  for (const m of members) {
    const text = formatClassMember(m)
    const w = estimateMonoTextWidth(text, CLS.memberFontSize)
    if (w > maxW) maxW = w
  }
  return maxW
}
