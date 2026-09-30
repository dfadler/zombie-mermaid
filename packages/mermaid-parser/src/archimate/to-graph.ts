import type {
  EdgeStyle,
  MermaidEdge,
  MermaidGraph,
  MermaidNode,
  MermaidSubgraph,
  NodeShape,
} from '@zombie-mermaid/core'
import { ARCHIMATE_ELEMENT_TYPES, ARCHIMATE_LAYERS } from './types.ts'
import type {
  ArchiMateDiagram,
  ArchiMateElement,
  ArchiMateElementType,
  ArchiMateLayer,
  ArchiMateRelationshipType,
} from './types.ts'

// ============================================================================
// ArchiMate -> flowchart lowering
//
// An ArchiMate layered view is boxes-and-arrows inside horizontal layer
// bands, which the flowchart pipeline already lays out and draws (ELK for SVG,
// the grid router for ASCII) including nested subgraphs and labelled edges.
// Like C4, ArchiMate is therefore lowered to a `MermaidGraph` and rides the
// existing renderers instead of getting a second layout engine.
// docs/decisions/archimate-lowering-1167.md records the choice and what it
// costs in notation fidelity.
//
//   layer            -> subgraph ("band"), stacked in canonical layer order
//   element          -> node; shape approximates the ArchiMate notation and a
//                       «Type» line names the element type
//   relationship     -> edge; line style and arrowhead approximate the
//                       notation and the label names the relationship type
// ============================================================================

/** Canonical top-to-bottom order of the layers, and their band titles. */
const LAYER_TITLE: Record<ArchiMateLayer, string> = {
  strategy: 'Strategy',
  motivation: 'Motivation',
  business: 'Business',
  application: 'Application',
  technology: 'Technology',
  physical: 'Physical',
  implementation: 'Implementation & Migration',
}

/** Rendering order, top to bottom. */
const LAYER_ORDER: readonly ArchiMateLayer[] = ARCHIMATE_LAYERS

/**
 * Element colours from the ArchiMate 3.2 specification's colour convention
 * (also Archi's defaults). Text is forced dark because the fills are light.
 */
const LAYER_COLORS: Record<ArchiMateLayer, { fill: string; stroke: string }> = {
  strategy: { fill: '#f5deaa', stroke: '#b8975a' },
  motivation: { fill: '#ccccff', stroke: '#7a7ab8' },
  business: { fill: '#ffffb5', stroke: '#b8b85a' },
  application: { fill: '#b5ffff', stroke: '#5ab8b8' },
  technology: { fill: '#c9e7b7', stroke: '#7fa46a' },
  physical: { fill: '#c9e7b7', stroke: '#7fa46a' },
  implementation: { fill: '#ffe0e0', stroke: '#b88a8a' },
}

const classNameFor = (layer: ArchiMateLayer): string => `archimate_${layer}`

/** Layer-qualifiers used when the same type name exists in several layers. */
const LAYER_QUALIFIER: Partial<Record<ArchiMateLayer, string>> = {
  business: 'Business',
  application: 'Application',
  technology: 'Technology',
}

const TYPE_LAYER_COUNT = new Map<string, number>()
for (const types of Object.values(ARCHIMATE_ELEMENT_TYPES)) {
  for (const t of types)
    TYPE_LAYER_COUNT.set(t, (TYPE_LAYER_COUNT.get(t) ?? 0) + 1)
}

/**
 * The stereotype text under an element name: `dataObject` -> `Data Object`,
 * qualified with its layer when the bare name is ambiguous (`service` exists
 * in the business, application and technology layers -> `Business Service`).
 */
export function archimateTypeName(
  type: ArchiMateElementType,
  layer?: ArchiMateLayer,
): string {
  const spaced = type.replace(/([a-z])([A-Z])/g, '$1 $2')
  const title = spaced.charAt(0).toUpperCase() + spaced.slice(1)
  const qualifier = layer ? LAYER_QUALIFIER[layer] : undefined
  return qualifier && (TYPE_LAYER_COUNT.get(type) ?? 0) > 1
    ? `${qualifier} ${title}`
    : title
}

const ELEMENT_SHAPE: Partial<Record<ArchiMateElementType, NodeShape>> = {
  // Behaviour elements are rounded in the ArchiMate notation.
  process: 'rounded',
  function: 'rounded',
  interaction: 'rounded',
  capability: 'rounded',
  courseOfAction: 'rounded',
  workPackage: 'rounded',
  service: 'stadium',
  event: 'asymmetric',
  implementationEvent: 'asymmetric',
  valueStream: 'hexagon',
  contract: 'divided-process',
  representation: 'document',
  deliverable: 'document',
  artifact: 'card',
  material: 'hexagon',
  // Motivation elements are ellipses / parallelograms.
  driver: 'stadium',
  assessment: 'stadium',
  goal: 'stadium',
  outcome: 'stadium',
  meaning: 'stadium',
  value: 'stadium',
  requirement: 'parallelogram',
  constraint: 'parallelogram',
}

/**
 * Line style and arrowheads per relationship. The flowchart edge model has
 * no diamond, hollow-triangle or dot markers, so composition/aggregation
 * carry no arrowhead, and every relationship except association is named in
 * its label (see the decision doc).
 */
const RELATIONSHIP_EDGE: Record<
  ArchiMateRelationshipType,
  { style: EdgeStyle; arrow: boolean }
> = {
  composition: { style: 'solid', arrow: false },
  aggregation: { style: 'solid', arrow: false },
  assignment: { style: 'solid', arrow: true },
  realization: { style: 'dotted', arrow: true },
  serving: { style: 'solid', arrow: true },
  access: { style: 'dotted', arrow: true },
  influence: { style: 'dotted', arrow: true },
  triggering: { style: 'solid', arrow: true },
  flow: { style: 'dotted', arrow: true },
  specialization: { style: 'solid', arrow: true },
  association: { style: 'solid', arrow: false },
}

function elementLabel(el: ArchiMateElement): string {
  return `${el.label}\n«${archimateTypeName(el.type, el.layer)}»`
}

/** A subgraph id that cannot collide with an element id. */
function uniqueLayerId(
  layer: ArchiMateLayer,
  taken: ReadonlySet<string>,
): string {
  let id = `__layer_${layer}`
  while (taken.has(id)) id += '_'
  return id
}

export interface ArchimateLoweringOptions {
  /**
   * Draw each layer as a titled subgraph band (default true). The ASCII grid
   * layout cannot place sibling subgraphs joined by cross-subgraph edges
   * (nodes land in the wrong box, or layout throws), so the ASCII renderer
   * passes `false` and layers are conveyed by vertical order and the
   * layer-qualified «Type» line alone.
   */
  bands?: boolean
}

/**
 * Lower a parsed ArchiMate diagram to the flowchart model.
 *
 * Layer order is enforced by an invisible edge from the first element of
 * each present layer to the first element of the next one below it, and by
 * emitting upward relationships reversed (see below) so no real edge fights
 * it. Layout treats an invisible edge like any other, so it is a strong hint
 * rather than a guarantee; see the decision doc.
 */
export function archimateToGraph(
  diagram: ArchiMateDiagram,
  options: ArchimateLoweringOptions = {},
): MermaidGraph {
  const bands = options.bands ?? true
  const nodes = new Map<string, MermaidNode>()
  const classAssignments = new Map<string, string>()
  const subgraphs: MermaidSubgraph[] = []
  const edges: MermaidEdge[] = []
  const usedLayers: ArchiMateLayer[] = []

  const taken = new Set(diagram.elements.keys())

  for (const layer of LAYER_ORDER) {
    const members = diagram.layers.get(layer)
    if (!members || members.length === 0) continue
    usedLayers.push(layer)
    for (const el of members) {
      nodes.set(el.id, {
        id: el.id,
        label: elementLabel(el),
        shape: ELEMENT_SHAPE[el.type] ?? 'rectangle',
      })
      classAssignments.set(el.id, classNameFor(layer))
    }
    if (bands) {
      subgraphs.push({
        id: uniqueLayerId(layer, taken),
        label: LAYER_TITLE[layer],
        nodeIds: members.map((m) => m.id),
        children: [],
      })
    }
  }

  for (const rel of diagram.relationships) {
    const { style, arrow } = RELATIONSHIP_EDGE[rel.type]
    // Most cross-layer relationships point upward (technology serves
    // application serves business), against the top-to-bottom layer order the
    // layout is asked to produce. Emit those edges reversed, with the
    // arrowhead on the source end, so every edge runs down the page and the
    // drawn arrow still points at the relationship's real target.
    const upward =
      LAYER_ORDER.indexOf(diagram.elements.get(rel.source)!.layer) >
      LAYER_ORDER.indexOf(diagram.elements.get(rel.target)!.layer)
    const edge: MermaidEdge = upward
      ? {
          source: rel.target,
          target: rel.source,
          style,
          hasArrowStart: arrow,
          hasArrowEnd: false,
        }
      : {
          source: rel.source,
          target: rel.target,
          style,
          hasArrowStart: false,
          hasArrowEnd: arrow,
        }
    if (rel.type !== 'association') edge.label = rel.type
    edges.push(edge)
  }

  for (let i = 0; i + 1 < usedLayers.length; i++) {
    const above = diagram.layers.get(usedLayers[i]!)![0]!
    const below = diagram.layers.get(usedLayers[i + 1]!)![0]!
    edges.push({
      source: above.id,
      target: below.id,
      style: 'invisible',
      hasArrowStart: false,
      hasArrowEnd: false,
    })
  }

  const classDefs = new Map<string, Record<string, string>>()
  for (const layer of usedLayers) {
    const { fill, stroke } = LAYER_COLORS[layer]
    classDefs.set(classNameFor(layer), { fill, stroke, color: '#1a1a1a' })
  }

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
