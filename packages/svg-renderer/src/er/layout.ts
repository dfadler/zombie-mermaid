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
  ErAttribute,
  PositionedErDiagram,
  PositionedErEntity,
  PositionedErRelationship,
} from '@zombie-mermaid/mermaid-parser'
import type { ErRenderOptions } from '@zombie-mermaid/core'
import { measureMultilineText, resolveNodeStyle } from '@zombie-mermaid/core'
import {
  FONT_WEIGHTS,
  resolveFontSizes,
  estimateTextWidth,
  estimateMonoTextWidth,
} from '../styles.ts'
import {
  mermaidSansTextWidth,
  mermaidTextWidth,
} from '../class/mermaid-text-width.ts'
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
export const ER = {
  padding: 40,
  /** Padding either side of the name in a bare entity (mermaid 12.3.0, #2678). */
  boxPadX: 20,
  /** Padding either side of the name in an entity with attributes. */
  headerPadX: 25,
  /** Left/right padding inside one attribute cell. */
  cellPadX: 12.5,
  /** Header and every row: a 24 text line plus 1.25 x `entityPadding` (15). */
  headerHeight: 42.75,
  /** An attribute-less entity is a taller box with a centred name, as in mermaid. */
  bareHeight: 84,
  rowHeight: 42.75,
  /** One line of text in a header or row; a `<br>` comment adds one per break. */
  textLineHeight: 24,
  /** Clear space kept around the label we draw, beyond its estimated width. */
  drawnLabelMargin: 8,
  /** Narrowest bare entity (`er.minEntityWidth`'s default). */
  minWidth: 100,
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

/** One attribute column: which `erCells` entry it shows, and its natural width. */
export interface ErColumn {
  cell: number
  width: number
}

/** A comment with each `<br>` as a newline (the tooltip text). */
export function commentLines(comment: string): string {
  return comment.replace(/<br\s{0,8}\/?>/gi, '\n')
}

/**
 * Each attribute column, as mermaid lays an entity out as a table:
 * type | name | keys | comment. The keys and comment columns exist only
 * when some attribute has one. Shared with the renderer, which spreads any
 * extra box width over these.
 */
export function erColumns(entity: {
  attributes: ReadonlyArray<ErAttribute>
}): ErColumn[] {
  const rows = entity.attributes.map(erCells)
  return [0, 1, 2, 3]
    .filter((i) => i < 2 || rows.some((r) => r[i]!.length > 0))
    .map((cell) => ({
      cell,
      width:
        Math.max(
          ...rows.flatMap((r) =>
            r[cell]!.split('\n')
              // Never narrower than the monospace text we draw.
              .map((line) =>
                Math.max(
                  mermaidTextWidth(line, false),
                  estimateMonoTextWidth(line, ER.attrFontSize),
                ),
              ),
          ),
        ) +
        ER.cellPadX * 2,
    }))
}

/** Lines in an attribute row: its tallest cell (a `<br>` in the comment starts a new line). */
export function erRowLines(a: ErAttribute): number {
  return Math.max(1, ...erCells(a).map((c) => c.split('\n').length))
}

/** Height of each attribute row: 24 per text line plus the row padding (mermaid's 1.25 x `entityPadding`). */
export function erRowHeights(
  attributes: ReadonlyArray<ErAttribute>,
  rowGrow: number,
): number[] {
  return attributes.map(
    (a) => ER.rowHeight + (erRowLines(a) - 1) * ER.textLineHeight + rowGrow,
  )
}

/** One attribute's cell texts: type, name, keys, comment (each `<br>` a newline). */
export function erCells(a: ErAttribute): [string, string, string, string] {
  return [
    a.type,
    a.name,
    a.keys.join(','),
    commentLines(a.comment ?? '')
      .split('\n')
      .map((line) => line.trim())
      .join('\n'),
  ]
}

/** Extra height per header/row from `er.entityPadding` (default 15), floored so rows stay legible. */
function erRowGrow(diagram: ErDiagram): number {
  return Math.max(-10, ((diagram.layout?.entityPadding ?? 15) - 15) * 1.25)
}

type EntitySizeMap = Map<string, { width: number; height: number }>

/** Build ELK graph and size map from an ER diagram. */
function buildErElkGraph(
  diagram: ErDiagram,
  options: ErRenderOptions,
): { elkGraph: ElkNode; entitySizes: EntitySizeMap } {
  const entitySizes: EntitySizeMap = new Map()
  const fontSizes = resolveFontSizes(options.fontSizes)

  // `er.diagramPadding` / `er.entityPadding` as deltas from mermaid's defaults
  // (20 / 15), applied to our scale. Measured against mermaid 12.3.0: a bare
  // entity grows 2 wide and 3 tall per unit of diagramPadding, each attribute
  // column 1.25 wide; the header and every row grow 1.25 tall per unit of
  // entityPadding.
  const dPad = (diagram.layout?.diagramPadding ?? 20) - 20
  const rowGrow = erRowGrow(diagram)
  const minEntityWidth = diagram.layout?.minEntityWidth ?? 0

  for (const entity of diagram.entities) {
    // Mermaid measures the name at 16px Trebuchet MS, regular weight.
    // Mermaid measures the name at 16px Trebuchet MS, regular weight.
    const headerTextW = mermaidTextWidth(entity.label, false)
    // The bold label we draw, at the configured size, must still fit with room to spare.
    const drawnLabelW =
      estimateTextWidth(
        entity.label,
        fontSizes.nodeLabel,
        FONT_WEIGHTS.nodeLabel,
      ) + ER.drawnLabelMargin
    const bare = entity.attributes.length === 0
    const columns = erColumns(entity)
    const tableW =
      columns.reduce((sum, c) => sum + c.width, 0) +
      columns.length * dPad * 1.25
    const width = Math.max(
      minEntityWidth,
      drawnLabelW,
      bare
        ? Math.max(
            // Mermaid's minimum applies when the name, measured in sans-serif
            // and rounded, plus its padding falls short of it.
            mermaidSansTextWidth(entity.label) + ER.boxPadX * 2 + dPad * 2 <
              ER.minWidth
              ? ER.minWidth
              : 0,
            headerTextW + ER.boxPadX * 2 + dPad * 2,
          )
        : Math.max(headerTextW + ER.headerPadX * 2 + dPad * 2, tableW),
    )
    const height = bare
      ? Math.max(20, ER.bareHeight + dPad * 3)
      : ER.headerHeight +
        rowGrow +
        erRowHeights(entity.attributes, rowGrow).reduce((a, b) => a + b, 0)
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
  const rowGrow = erRowGrow(diagram)
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
        headerHeight:
          entity.attributes.length === 0
            ? size.height
            : ER.headerHeight + rowGrow,
        rowHeight: ER.rowHeight + rowGrow,
        rowHeights: erRowHeights(entity.attributes, rowGrow),
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
