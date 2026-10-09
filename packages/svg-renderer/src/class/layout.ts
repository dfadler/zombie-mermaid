/**
 * Class diagram layout engine (ELK.js).
 *
 * Each class box has 3 compartments:
 *   1. Header (class name + optional annotation)
 *   2. Attributes section
 *   3. Methods section
 */

import type { ElkNode, ElkExtendedEdge } from '@zombie-mermaid/core'
import type {
  ClassDiagram,
  ClassNode,
  ClassMember,
  PositionedClassDiagram,
  PositionedClassNode,
  PositionedClassNamespace,
  PositionedClassNote,
  PositionedClassRelationship,
} from '@zombie-mermaid/mermaid-parser'
import { formatClassMember } from '@zombie-mermaid/mermaid-parser'
import type { ClassRenderOptions } from '@zombie-mermaid/core'
import {
  estimateTextWidth,
  estimateMonoTextWidth,
  FONT_WEIGHTS,
  resolveFontSizes,
} from '../styles.ts'
import { elkLayoutSync } from '../elk-instance.ts'
import {
  extractEdgePoints,
  extractEdgeLabelPosition,
} from '../layout-engine/elk-adapter-utils.ts'
import {
  ELK_DIRECTION_FALLBACK,
  baseElkLayoutOptions,
  buildElkEdge,
  buildElkLeafNode,
  directionToElk,
  elkPadding,
} from '../layout-engine/elk-graph-builder.ts'
import { measureMultilineText, resolveNodeStyle } from '@zombie-mermaid/core'

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
  /** Space reserved above a namespace's classes for its title */
  namespaceTitleHeight: 28,
  /** Padding between a namespace frame and its classes (other three sides) */
  namespacePad: 16,
  namespaceTitleFontSize: 12,
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

/** Layout id for the i-th namespace; contains a space, so it can't match a class id. */
function classNamespaceId(index: number): string {
  return `namespace ${index}`
}

/** A namespace that has at least one member class, ready for layout. */
interface LayoutNamespace {
  id: string
  name: string
  classIds: string[]
}

/**
 * Namespaces to draw: members that aren't classes of the diagram are dropped,
 * a class claimed by two namespaces stays in the first (ELK nodes have one
 * parent), and a namespace left with no members is skipped.
 */
function resolveNamespaces(diagram: ClassDiagram): LayoutNamespace[] {
  const known = new Set(diagram.classes.map((c) => c.id))
  const claimed = new Set<string>()
  const out: LayoutNamespace[] = []
  for (const [i, ns] of diagram.namespaces.entries()) {
    const classIds: string[] = []
    for (const id of ns.classIds) {
      if (!known.has(id) || claimed.has(id)) continue
      claimed.add(id)
      classIds.push(id)
    }
    if (classIds.length > 0) {
      out.push({ id: classNamespaceId(i), name: ns.name, classIds })
    }
  }
  return out
}

/** Size of each note box, keyed by its layout id. */
type NoteSizeMap = Map<string, { width: number; height: number }>

/** Build ELK graph and size map from a class diagram. */
function buildClassElkGraph(
  diagram: ClassDiagram,
  options: ClassRenderOptions,
): {
  elkGraph: ElkNode
  classSizes: ClassSizeMap
  noteSizes: NoteSizeMap
  namespaces: LayoutNamespace[]
} {
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
  const namespaces = resolveNamespaces(diagram)
  const namespaceOf = new Map<string, string>()
  for (const ns of namespaces) {
    for (const id of ns.classIds) namespaceOf.set(id, ns.id)
  }
  const namespaceNodes = new Map<string, ElkNode>()
  const children: ElkNode[] = []
  for (const ns of namespaces) {
    // Wide enough for the title; ELK grows it to fit the classes inside.
    const titleW =
      estimateTextWidth(
        ns.name,
        CLS.namespaceTitleFontSize,
        FONT_WEIGHTS.groupHeader,
      ) +
      CLS.namespacePad * 2
    const node: ElkNode = {
      id: ns.id,
      children: [],
      layoutOptions: {
        'elk.padding': elkPadding({
          top: CLS.namespaceTitleHeight + CLS.namespacePad / 2,
          left: CLS.namespacePad,
          bottom: CLS.namespacePad,
          right: CLS.namespacePad,
        }),
        'elk.nodeSize.constraints': 'MINIMUM_SIZE',
        'elk.nodeSize.minimum': `(${Math.ceil(titleW)}, 0)`,
      },
    }
    namespaceNodes.set(ns.id, node)
    children.push(node)
  }
  for (const [id, size] of classSizes) {
    const leaf = buildElkLeafNode(id, size)
    const parent = namespaceNodes.get(namespaceOf.get(id) ?? '')
    if (parent?.children) parent.children.push(leaf)
    else children.push(leaf)
  }

  // Class edge labels carry no per-label layout options — placement is set
  // once on the root graph below (`elk.edgeLabels.placement: CENTER`).
  const labelStyle = { fontSize: fontSizes.edgeLabel }

  const edges: ElkExtendedEdge[] = []
  for (const [i, rel] of diagram.relationships.entries()) {
    edges.push(
      buildElkEdge({
        id: `e${i}`,
        source: rel.from,
        target: rel.to,
        label: rel.label,
        labelStyle,
      }),
    )
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
    children.push(buildElkLeafNode(id, size))
    if (note.forClass !== undefined && classIds.has(note.forClass)) {
      edges.push(
        buildElkEdge({
          id: classNoteLinkId(id),
          source: id,
          target: note.forClass,
          labelStyle,
        }),
      )
    }
  }

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      ...baseElkLayoutOptions({
        // Class diagrams have no `direction` concept — they always lay out
        // top-down. See ELK_DIRECTION_FALLBACK for why that default is
        // per-diagram-type rather than shared with ER's.
        direction: directionToElk(undefined, ELK_DIRECTION_FALLBACK.class),
        nodeSpacing: CLS.nodeSpacing,
        layerSpacing: CLS.layerSpacing,
        padding: CLS.padding,
      }),
      'elk.edgeLabels.placement': 'CENTER',
      // Relationships are declared at the root and may cross namespace
      // frames; INCLUDE_CHILDREN routes them in one pass through the nesting.
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      // Mermaid lays disconnected components out left to right in
      // declaration order (#1249). ELK's default packs components by size
      // into rows, which reorders them; laying them out as one graph with
      // model order as the tie-break keeps source order.
      'elk.separateConnectedComponents': 'false',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    },
    children,
    edges,
  }

  return { elkGraph, classSizes, noteSizes, namespaces }
}

/** Extract positioned classes, relationships, and notes from ELK result. */
function extractClassLayout(
  result: ElkNode,
  diagram: ClassDiagram,
  classSizes: ClassSizeMap,
  noteSizes: NoteSizeMap,
  namespaces: LayoutNamespace[],
): PositionedClassDiagram {
  const classLookup = new Map<string, ClassNode>()
  for (const cls of diagram.classes) classLookup.set(cls.id, cls)

  // ELK reports a nested node relative to its parent. Namespaces are one
  // level deep, so flatten each member into diagram coordinates.
  const namespaceIds = new Set(namespaces.map((ns) => ns.id))
  const namespaceOffsets = new Map<string, { x: number; y: number }>()
  const flatChildren: ElkNode[] = []
  for (const child of result.children ?? []) {
    if (namespaceIds.has(child.id)) {
      const ox = child.x ?? 0
      const oy = child.y ?? 0
      namespaceOffsets.set(child.id, { x: ox, y: oy })
      for (const inner of child.children ?? []) {
        flatChildren.push({
          ...inner,
          x: (inner.x ?? 0) + ox,
          y: (inner.y ?? 0) + oy,
        })
      }
    } else {
      flatChildren.push(child)
    }
  }
  // Under INCLUDE_CHILDREN an edge's points are relative to its container
  // (the lowest common ancestor of its endpoints): a namespace for an edge
  // inside one, the root otherwise.
  const edgeOffset = (edge: ElkExtendedEdge): { x: number; y: number } => {
    const container = (edge as { container?: string }).container
    return (container && namespaceOffsets.get(container)) || { x: 0, y: 0 }
  }

  const positionedNamespaces: PositionedClassNamespace[] = []
  for (const ns of namespaces) {
    const node = (result.children ?? []).find((c) => c.id === ns.id)
    if (!node) continue
    positionedNamespaces.push({
      name: ns.name,
      classIds: ns.classIds,
      x: node.x ?? 0,
      y: node.y ?? 0,
      width: node.width ?? 0,
      height: node.height ?? 0,
    })
  }

  const positionedClasses: PositionedClassNode[] = []
  for (const child of flatChildren) {
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

    const off = edgeOffset(elkEdge)
    const points = extractEdgePoints(elkEdge, off.x, off.y)
    const labelPosition = extractEdgeLabelPosition(elkEdge, off.x, off.y)

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
  for (const child of flatChildren) childById.set(child.id, child)

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
      ...(link
        ? {
            linkPoints: extractEdgePoints(
              link,
              edgeOffset(link).x,
              edgeOffset(link).y,
            ),
          }
        : {}),
    })
  }

  return {
    width: result.width ?? 600,
    height: result.height ?? 400,
    classes: positionedClasses,
    relationships,
    notes,
    namespaces: positionedNamespaces,
  }
}

/**
 * Lay out a parsed class diagram using ELK.js (synchronous).
 */
export function layoutClassDiagramSync(
  diagram: ClassDiagram,
  options: ClassRenderOptions = {},
): PositionedClassDiagram {
  if (diagram.classes.length === 0 && diagram.notes.length === 0) {
    return {
      width: 0,
      height: 0,
      classes: [],
      relationships: [],
      notes: [],
      namespaces: [],
    }
  }

  const { elkGraph, classSizes, noteSizes, namespaces } = buildClassElkGraph(
    diagram,
    options,
  )
  const result = elkLayoutSync(elkGraph, options.layoutCache)
  return extractClassLayout(result, diagram, classSizes, noteSizes, namespaces)
}

/**
 * Width of a member line sized for the worst-case glyph advance.
 *
 * The mono face advances 0.6em per glyph (6.6px at the 11px member size), but
 * browsers that don't position glyphs at subpixel offsets (headless Chromium
 * on Linux, notably) round each advance to a whole pixel, so a long member
 * draws up to 0.4px per character wider than `estimateMonoTextWidth` says and
 * ran into the box's right border (#1238). Rounding the advance up here keeps
 * the full `CLS.boxPadX` of right padding whichever way the font is rasterized.
 */
function memberTextWidth(text: string): number {
  return text.length * Math.ceil(estimateMonoTextWidth('M', CLS.memberFontSize))
}

/** Calculate the max width of a list of class members (uses mono metrics) */
function maxMemberWidth(members: ClassMember[]): number {
  if (members.length === 0) return 0
  let maxW = 0
  for (const m of members) {
    const w = memberTextWidth(formatClassMember(m))
    if (w > maxW) maxW = w
  }
  return maxW
}
