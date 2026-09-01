/**
 * ER diagram layout engine (ELK.js).
 *
 * Each entity box has:
 *   1. Header (entity name)
 *   2. Attribute rows (type, name, keys)
 */

import type { ElkNode, ElkExtendedEdge } from 'elkjs'
import type {
  ErDiagram,
  ErEntity,
  PositionedErDiagram,
  PositionedErEntity,
  PositionedErRelationship,
} from './types.ts'
import type { RenderOptions } from '../types.ts'
import {
  estimateTextWidth,
  estimateMonoTextWidth,
  FONT_WEIGHTS,
  resolveFontSizes,
} from '../styles.ts'
import { measureMultilineText } from '../text-metrics.ts'
import { elkLayoutSync } from '../elk-instance.ts'
import { extractEdgePoints } from '../layout-engine/elk-adapter-utils.ts'
import type { Direction } from '../types.ts'

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
} as const

type EntitySizeMap = Map<string, { width: number; height: number }>

/**
 * Convert a Mermaid direction to an ELK layout direction.
 * ER diagrams default to left-to-right (`RIGHT`) when no `direction`
 * statement is present, matching this renderer's historical default —
 * unlike flowcharts, which default to top-down.
 */
function directionToElk(dir: Direction | undefined): string {
  switch (dir) {
    case 'TD':
    case 'TB':
      return 'DOWN'
    case 'BT':
      return 'UP'
    case 'RL':
      return 'LEFT'
    case 'LR':
    default:
      return 'RIGHT'
  }
}

/** Build ELK graph and size map from an ER diagram. */
function buildErElkGraph(
  diagram: ErDiagram,
  options: RenderOptions,
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
      const w = estimateMonoTextWidth(attrText, ER.attrFontSize)
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
    children.push({ id, width: size.width, height: size.height })
  }

  const edges: ElkExtendedEdge[] = []
  for (const [i, rel] of diagram.relationships.entries()) {
    const metrics = measureMultilineText(
      rel.label,
      fontSizes.edgeLabel,
      FONT_WEIGHTS.edgeLabel,
    )
    const edge: ElkExtendedEdge = {
      id: `e${i}`,
      sources: [rel.entity1],
      targets: [rel.entity2],
    }
    if (rel.label) {
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

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': directionToElk(diagram.direction),
      'elk.spacing.nodeNode': String(ER.nodeSpacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(ER.layerSpacing),
      'elk.padding': `[top=${ER.padding},left=${ER.padding},bottom=${ER.padding},right=${ER.padding}]`,
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.edgeLabels.placement': 'CENTER',
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
      })
    }
  }

  const relationships: PositionedErRelationship[] = []
  for (const [i, elkEdge] of (result.edges ?? []).entries()) {
    // diagram.relationships[i] is guaranteed by construction: buildErElkGraph
    // creates exactly one ELK edge per relationship, in the same order.
    const rel = diagram.relationships[i]!

    const points = extractEdgePoints(elkEdge)

    relationships.push({
      entity1: rel.entity1,
      entity2: rel.entity2,
      cardinality1: rel.cardinality1,
      cardinality2: rel.cardinality2,
      label: rel.label,
      identifying: rel.identifying,
      points,
    })
  }

  return {
    width: result.width ?? 600,
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
  options: RenderOptions = {},
): PositionedErDiagram {
  if (diagram.entities.length === 0) {
    return { width: 0, height: 0, entities: [], relationships: [] }
  }

  const { elkGraph, entitySizes } = buildErElkGraph(diagram, options)
  const result = elkLayoutSync(elkGraph, options.layoutCache)
  return extractErLayout(result, diagram, entitySizes)
}
