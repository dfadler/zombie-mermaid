/**
 * ER diagram layout engine (ELK.js).
 *
 * Each entity box has:
 *   1. Header (entity name)
 *   2. Attribute rows (type, name, keys)
 */

import type { ElkNode, ElkExtendedEdge } from '@zombie-mermaid/core'
import type {
  ErDiagram,
  ErEntity,
  PositionedErDiagram,
  PositionedErEntity,
  PositionedErRelationship,
} from '@zombie-mermaid/mermaid-parser'
import type { ErRenderOptions } from '@zombie-mermaid/core'
import { measureMultilineText, resolveNodeStyle } from '@zombie-mermaid/core'
import {
  estimateTextWidth,
  estimateMonoTextWidth,
  FONT_WEIGHTS,
  resolveFontSizes,
} from '../styles.ts'
import { elkLayoutSync } from '../elk-instance.ts'
import { extractEdgePoints } from '../layout-engine/elk-adapter-utils.ts'
import {
  ELK_DIRECTION_FALLBACK,
  baseElkLayoutOptions,
  buildElkEdge,
  buildElkLeafNode,
  directionToElk,
} from '../layout-engine/elk-graph-builder.ts'

/** Layout constants for ER diagrams */
const ER = {
  padding: 40,
  boxPadX: 14,
  headerHeight: 34,
  rowHeight: 22,
  minWidth: 140,
  attrFontSize: 11,
  attrFontWeight: 400,
  nodeSpacing: 70,
  layerSpacing: 90,
  // Self-relationship loop (#2284), measured from mermaid 12.1.0 and 12.2.0:
  // the first loop leaves the box 20px to the left, its markers 10px either
  // side of the middle, with the label beside it.
  loopOut: 20,
  loopHalf: 10,
  loopLabelGap: 4,
  loopNestGap: 16,
  /** Smallest left margin left clear for a loop's label. */
  loopMargin: 12,
} as const

interface SelfLoop {
  /** Index into `diagram.relationships`. */
  index: number
  /** 0 for the innermost loop. */
  nest: number
  /** How far left of the box the loop's vertical leg sits. */
  out: number
  /** Width of the label box (0 without a label). */
  labelW: number
}

/**
 * The self-relationships of one entity, nested outwards: each further loop
 * sits beyond the previous loop's label, as mermaid draws them.
 */
function selfLoops(
  diagram: ErDiagram,
  id: string,
  options: ErRenderOptions,
): SelfLoop[] {
  const fontSize = resolveFontSizes(options.fontSizes).edgeLabel
  const loops: SelfLoop[] = []
  for (const [index, rel] of diagram.relationships.entries()) {
    if (rel.entity1 !== id || rel.entity2 !== id) continue
    const prev = loops[loops.length - 1]
    const labelW = rel.label
      ? measureMultilineText(rel.label, fontSize, FONT_WEIGHTS.edgeLabel)
          .width + 8
      : 0
    loops.push({
      index,
      nest: loops.length,
      out: prev
        ? prev.out + ER.loopLabelGap + prev.labelW + ER.loopNestGap
        : ER.loopOut,
      labelW,
    })
  }
  return loops
}

type EntitySizeMap = Map<string, { width: number; height: number }>

/** Build ELK graph and size map from an ER diagram. */
/**
 * Width of an attribute row sized for the worst-case glyph advance.
 *
 * The mono face advances 0.6em per glyph (6.6px at the 11px attribute size),
 * but browsers that don't position glyphs at subpixel offsets (headless
 * Chromium on Linux) round each advance to a whole pixel, so a long row draws
 * wider than `estimateMonoTextWidth` says and the type runs into the
 * right-aligned name (#1262, same cause as class members in #1238).
 */
function attrTextWidth(text: string): number {
  return text.length * Math.ceil(estimateMonoTextWidth('M', ER.attrFontSize))
}

function buildErElkGraph(
  diagram: ErDiagram,
  options: ErRenderOptions,
): { elkGraph: ElkNode; entitySizes: EntitySizeMap } {
  const entitySizes: EntitySizeMap = new Map()
  const fontSizes = resolveFontSizes(options.fontSizes)

  for (const entity of diagram.entities) {
    const headerTextW = estimateTextWidth(
      entity.label,
      fontSizes.nodeLabel,
      FONT_WEIGHTS.nodeLabel,
    )
    let maxAttrW = 0
    for (const attr of entity.attributes) {
      const attrText = `${attr.type}  ${attr.name}${attr.keys.length > 0 ? '  ' + attr.keys.join(',') : ''}`
      const w = attrTextWidth(attrText)
      if (w > maxAttrW) maxAttrW = w
    }
    const width = Math.max(
      ER.minWidth,
      headerTextW + ER.boxPadX * 2,
      maxAttrW + ER.boxPadX * 2,
    )
    const height =
      ER.headerHeight + Math.max(entity.attributes.length, 1) * ER.rowHeight
    entitySizes.set(entity.id, { width, height })
  }

  // Iterate entitySizes directly (populated above, in diagram.entities order)
  // rather than looking each entity back up by id — sidesteps needing an
  // assertion or invariant check for a lookup that can't actually miss.
  const children: ElkNode[] = []
  for (const [id, size] of entitySizes) {
    children.push(buildElkLeafNode(id, size))
  }

  // ER edge labels carry no per-label layout options — placement is set
  // once on the root graph below (`elk.edgeLabels.placement: CENTER`).
  const labelStyle = { fontSize: fontSizes.edgeLabel }

  const edges: ElkExtendedEdge[] = []
  for (const [i, rel] of diagram.relationships.entries()) {
    // A self-relationship is a loop beside its entity, laid out afterwards.
    if (rel.entity1 === rel.entity2) continue
    edges.push(
      buildElkEdge({
        id: `e${i}`,
        source: rel.entity1,
        target: rel.entity2,
        label: rel.label,
        labelStyle,
      }),
    )
  }

  // Room a neighbour must leave left of a box for its self loops and labels.
  let loopReserve = 0
  for (const entity of diagram.entities) {
    const loops = selfLoops(diagram, entity.id, options)
    const last = loops[loops.length - 1]
    if (last) loopReserve = Math.max(loopReserve, last.out + last.labelW)
  }

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      ...baseElkLayoutOptions({
        // A source with no `direction` statement lays out top-to-bottom,
        // as official Mermaid does (#1250). See ELK_DIRECTION_FALLBACK.
        direction: directionToElk(diagram.direction, ELK_DIRECTION_FALLBACK.er),
        nodeSpacing: Math.max(ER.nodeSpacing, loopReserve + 20),
        layerSpacing: Math.max(ER.layerSpacing, loopReserve + 20),
        padding: ER.padding,
      }),
      'elk.edgeLabels.placement': 'CENTER',
      // Keep declaration order as the crossing-minimization tie-break and
      // center children under their parents, as official Mermaid does.
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      // Mermaid lays disconnected components out in declaration order
      // (#1795); ELK's default packs them by size, which reorders them.
      'elk.separateConnectedComponents': 'false',
      'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
    },
    children,
    edges,
  }

  return { elkGraph, entitySizes }
}

/** Extract positioned entities and relationships from ELK result. */
function extractErLayout(
  result: ElkNode,
  diagram: ErDiagram,
  entitySizes: EntitySizeMap,
  options: ErRenderOptions,
): PositionedErDiagram {
  const entityLookup = new Map<string, ErEntity>()
  for (const entity of diagram.entities) entityLookup.set(entity.id, entity)

  const positionedEntities: PositionedErEntity[] = []
  for (const child of result.children ?? []) {
    const entity = entityLookup.get(child.id)
    if (entity) {
      const size = entitySizes.get(entity.id)
      if (!size) {
        // Unreachable — entitySizes is populated for every diagram.entities
        // entry, and entityLookup/entity.id come from that same list.
        /* v8 ignore next */
        throw new Error(`Missing computed size for entity "${entity.id}"`)
      }
      positionedEntities.push({
        id: entity.id,
        label: entity.label,
        attributes: entity.attributes,
        x: child.x ?? 0,
        y: child.y ?? 0,
        width: child.width ?? size.width,
        height: child.height ?? size.height,
        headerHeight: ER.headerHeight,
        rowHeight: ER.rowHeight,
        // Same cascade flowcharts and class diagrams use: classDef default →
        // assigned class → `style`. Invalid colours are dropped there.
        inlineStyle: resolveNodeStyle(entity.id, diagram),
        className: diagram.classAssignments.get(entity.id),
      })
    }
  }

  const elkEdges = new Map((result.edges ?? []).map((e) => [e.id, e]))
  const relationships: PositionedErRelationship[] = []
  let minX = Infinity
  for (const [i, rel] of diagram.relationships.entries()) {
    const base = {
      entity1: rel.entity1,
      entity2: rel.entity2,
      cardinality1: rel.cardinality1,
      cardinality2: rel.cardinality2,
      label: rel.label,
      identifying: rel.identifying,
    }
    if (rel.entity1 !== rel.entity2) {
      // buildErElkGraph creates one ELK edge `e<i>` per non-self relationship.
      relationships.push({
        ...base,
        points: extractEdgePoints(elkEdges.get(`e${i}`)!),
      })
      continue
    }
    const box = positionedEntities.find((e) => e.id === rel.entity1)!
    const loop = selfLoops(diagram, rel.entity1, options).find(
      (l) => l.index === i,
    )!
    const cy = box.y + box.height / 2
    const half = Math.max(ER.loopHalf, box.height / 8) + 10 * loop.nest
    const lx = box.x - loop.out
    relationships.push({
      ...base,
      points: [
        { x: box.x, y: cy - half },
        { x: lx, y: cy - half },
        { x: lx, y: cy + half },
        { x: box.x, y: cy + half },
      ],
      labelPoint: { x: lx - ER.loopLabelGap - loop.labelW / 2, y: cy },
    })
    minX = Math.min(minX, lx - ER.loopLabelGap - loop.labelW)
  }

  // Keep a loop's label inside the canvas.
  const dx = Math.max(0, ER.loopMargin - minX)
  if (dx > 0) {
    for (const e of positionedEntities) e.x += dx
    for (const r of relationships) {
      for (const p of r.points) p.x += dx
      if (r.labelPoint) r.labelPoint.x += dx
    }
  }

  return {
    width: (result.width ?? 600) + dx,
    height: result.height ?? 400,
    entities: positionedEntities,
    relationships,
  }
}

/**
 * Lay out a parsed ER diagram using ELK.js (synchronous).
 */
export function layoutErDiagramSync(
  diagram: ErDiagram,
  options: ErRenderOptions = {},
): PositionedErDiagram {
  if (diagram.entities.length === 0) {
    return { width: 0, height: 0, entities: [], relationships: [] }
  }

  const { elkGraph, entitySizes } = buildErElkGraph(diagram, options)
  const result = elkLayoutSync(elkGraph, options.layoutCache)
  return extractErLayout(result, diagram, entitySizes, options)
}
