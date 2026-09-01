// ============================================================================
// ASCII renderer — ER diagrams
//
// Renders erDiagram text to ASCII/Unicode art.
// Each entity is a 2-section box (header | attributes).
// Relationships are drawn as lines with crow's foot notation at endpoints.
//
// Layout: entities are placed in a grid pattern (multiple rows if needed).
// Relationship lines use Manhattan routing between entity boxes.
// ============================================================================

import { parseErDiagram } from '../er/parser.ts'
import type {
  ErDiagram,
  ErEntity,
  ErAttribute,
  Cardinality,
} from '../er/types.ts'
import type {
  AsciiConfig,
  CharRole,
  AsciiTheme,
  ColorMode,
  Canvas,
} from './types.ts'
import {
  mkCanvas,
  mkRoleCanvas,
  canvasToString,
  increaseSize,
  increaseRoleCanvasSize,
  write,
} from './canvas.ts'
import { drawMultiBox, measureMultiBox, classifyBoxChar } from './draw.ts'
import { splitLines, maxLineWidth } from './multiline-utils.ts'
import { splitStatements } from '../statements.ts'
import { toDisplayCells } from './display-width.ts'

// ============================================================================
// Entity box content
// ============================================================================

/** Format an attribute line: "PK type name" or "FK type name" etc. */
function formatAttribute(attr: ErAttribute): string {
  const keyStr = attr.keys.length > 0 ? attr.keys.join(',') + ' ' : '   '
  return `${keyStr}${attr.type} ${attr.name}`
}

/** Build sections for an entity box: [header], [attributes] */
function buildEntitySections(entity: ErEntity): string[][] {
  // Support multi-line entity names
  const header = splitLines(entity.label)
  const attrs = entity.attributes.map(formatAttribute)
  if (attrs.length === 0) return [header]
  return [header, attrs]
}

// ============================================================================
// Crow's foot notation
// ============================================================================

/**
 * Returns the ASCII/Unicode characters for a crow's foot cardinality marker.
 * Markers are drawn adjacent to entity boxes at relationship endpoints.
 *
 * Standard ER notation:
 *   one:       ─┤├─   perpendicular line (exactly one)
 *   zero-one:  ─○┤─   circle + perpendicular (zero or one)
 *   many:      ─<>─   crow's foot (one or more)
 *   zero-many: ─○<─   circle + crow's foot (zero or more)
 *
 * @param card - The cardinality type
 * @param useAscii - Use ASCII-only characters
 * @param isRight - True if this marker is on the right side of the relationship
 */
function getCrowsFootChars(
  card: Cardinality,
  useAscii: boolean,
  isRight = false,
): string {
  if (useAscii) {
    switch (card) {
      case 'one':
        return '|'
      case 'zero-one':
        return isRight ? 'o|' : '|o'
      case 'many':
        return isRight ? '<' : '>'
      case 'zero-many':
        return isRight ? 'o<' : '>o'
    }
  } else {
    // Use cleaner Unicode characters
    switch (card) {
      case 'one':
        return '│'
      case 'zero-one':
        return isRight ? '○│' : '│○'
      case 'many':
        return isRight ? '╟' : '╢'
      case 'zero-many':
        return isRight ? '○╟' : '╢○'
    }
  }
}

// ============================================================================
// Positioned entity
// ============================================================================

interface PlacedEntity {
  entity: ErEntity
  sections: string[][]
  x: number
  y: number
  width: number
  height: number
}

// ============================================================================
// Connected Component Detection
// ============================================================================

/**
 * Find connected components in the ER diagram using DFS.
 * Treats relationships as undirected edges for connectivity.
 *
 * Returns an array of entity ID sets, one per connected component.
 */
function findConnectedComponents(diagram: ErDiagram): Set<string>[] {
  const visited = new Set<string>()
  const components: Set<string>[] = []

  // Build undirected adjacency list from relationships
  const neighbors = new Map<string, Set<string>>()
  for (const ent of diagram.entities) {
    neighbors.set(ent.id, new Set())
  }
  for (const rel of diagram.relationships) {
    neighbors.get(rel.entity1)?.add(rel.entity2)
    neighbors.get(rel.entity2)?.add(rel.entity1)
  }

  // DFS to find each component
  function dfs(startId: string, component: Set<string>): void {
    const stack = [startId]
    while (stack.length > 0) {
      const nodeId = stack.pop()!
      if (visited.has(nodeId)) continue

      visited.add(nodeId)
      component.add(nodeId)

      for (const neighbor of neighbors.get(nodeId) ?? []) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor)
        }
      }
    }
  }

  // Find all components
  for (const ent of diagram.entities) {
    if (!visited.has(ent.id)) {
      const component = new Set<string>()
      dfs(ent.id, component)
      if (component.size > 0) {
        components.push(component)
      }
    }
  }

  return components
}

// ============================================================================
// Layout and rendering
// ============================================================================

/**
 * Look up a per-entity value computed by renderErAscii's box-sizing pass.
 * Every entity in `diagram.entities` gets an entry in `entityBoxW`,
 * `entityBoxH`, and `entitySections` before layout runs, so this always
 * succeeds for a real diagram entity — but that guarantee is established by
 * a separate imperative loop the compiler can't connect back to this
 * lookup, so it's checked explicitly rather than trusted via `!`.
 */
function mustGetEntityValue<T>(
  map: Map<string, T>,
  entityId: string,
  what: string,
): T {
  const value = map.get(entityId)
  if (value === undefined) {
    /* v8 ignore next */
    throw new Error(
      `ER diagram layout: missing ${what} for entity "${entityId}"`,
    )
  }
  return value
}

/**
 * Check whether every cell in row `y` across [xStart, xEnd] is still blank
 * on `canvas`, ignoring column `skipX` (the relationship's own vertical
 * stem, which legitimately already occupies that column across the whole
 * gap before a jog row is chosen — see `chooseFreeRow`).
 *
 * A column past the canvas's current width isn't drawn yet — `canvas[x]` is
 * `undefined` there — but it isn't *occupied* either: relationship labels
 * routinely land past the initial bounds and grow the canvas on write (see
 * `increaseSize` at the label-drawing call sites below). Treating that as
 * "not free" made `chooseFreeRow` reject perfectly good candidate rows near
 * the canvas edge and fall back to the plain midpoint instead, undermining
 * the whole point of the search.
 */
// Exported for direct unit testing (see check-diff-coverage.ts's own
// exports for the precedent this repo already uses) — renderErAscii's fixed
// vGap never produces a gap wide enough to exercise every branch of
// chooseFreeRow's search order through the full render pipeline alone, so
// the row-selection logic itself is tested directly against constructed
// inputs instead.
export function isRowFree(
  canvas: Canvas,
  y: number,
  xStart: number,
  xEnd: number,
  skipX: number,
): boolean {
  for (let x = xStart; x <= xEnd; x++) {
    if (x === skipX) continue
    const col = canvas[x]
    if (col === undefined) continue // not drawn yet — not occupied
    if (col[y] !== ' ' && col[y] !== undefined) return false
  }
  return true
}

/**
 * Choose a row for a vertical relationship's horizontal jog segment,
 * preferring the geometric midpoint between `startY` and `endY` but
 * scanning outward (alternating below/above) for the nearest row across
 * [xStart, xEnd] that isn't already occupied — by an entity box the naive
 * midpoint would otherwise cut through, or by another relationship's
 * already-drawn jog (see issue #351: every vertical relationship between
 * the same two component rows previously computed the *same* midpoint,
 * so their jogs and labels landed on one shared row and overwrote each
 * other). Candidates are restricted to the open interval (startY, endY) so
 * the chosen row never collides with the crow's-foot markers flush against
 * either entity border.
 *
 * Falls back to the plain midpoint — the only row every caller used before
 * this fix — when the gap is too small to have any candidate row at all, or
 * when every candidate in the gap is occupied (a dense diagram where
 * avoiding collisions entirely isn't possible with this renderer's
 * straight-jog routing).
 *
 * Exported for direct unit testing — see the comment on `isRowFree` above.
 */
export function chooseFreeRow(
  canvas: Canvas,
  startY: number,
  endY: number,
  xStart: number,
  xEnd: number,
  skipX: number,
): number {
  const preferred = Math.floor((startY + endY) / 2)
  if (isRowFree(canvas, preferred, xStart, xEnd, skipX)) return preferred

  const maxOffset = endY - startY
  for (let d = 1; d <= maxOffset; d++) {
    const below = preferred + d
    if (below < endY && isRowFree(canvas, below, xStart, xEnd, skipX)) {
      return below
    }
    const above = preferred - d
    if (above > startY && isRowFree(canvas, above, xStart, xEnd, skipX)) {
      return above
    }
  }
  return preferred
}

/**
 * Render a Mermaid ER diagram to ASCII/Unicode text.
 *
 * Pipeline: parse → build boxes → component-aware layout → draw boxes → draw relationships → string.
 */
export function renderErAscii(
  text: string,
  config: AsciiConfig,
  colorMode?: ColorMode,
  theme?: AsciiTheme,
): string {
  const lines = splitStatements(text)
  const diagram = parseErDiagram(lines)

  if (diagram.entities.length === 0) return ''

  const useAscii = config.useAscii
  const hGap = 6 // horizontal gap between entity boxes
  const vGap = 4 // vertical gap between rows (for relationship lines)
  // Vertical gap between disconnected components. Unlike vGap, this gap
  // never needs to fit a relationship line, a jog, or a label — disconnected
  // components have no edges between them by definition — so it only needs
  // enough room to read as a visual break between unrelated entities, not
  // the same routing headroom a same-component row wrap needs. A gap this
  // large previously left most of the output blank for diagrams with a few
  // small unrelated components (issue #351).
  const componentGap = 2

  // --- Build entity box dimensions ---
  const entitySections = new Map<string, string[][]>()
  const entityBoxW = new Map<string, number>()
  const entityBoxH = new Map<string, number>()
  const entityById = new Map<string, ErEntity>()

  for (const ent of diagram.entities) {
    entityById.set(ent.id, ent)
    const sections = buildEntitySections(ent)
    entitySections.set(ent.id, sections)

    // Reserve exactly what drawMultiBox will draw — measuring it here rather
    // than re-deriving the arithmetic keeps layout and drawing in lockstep for
    // wide-character (CJK/fullwidth) content.
    const { width: boxW, height: boxH } = measureMultiBox(sections)

    entityBoxW.set(ent.id, boxW)
    entityBoxH.set(ent.id, boxH)
  }

  // Widest relationship label between each unordered pair of entities.
  // Used to widen the horizontal gap between entities so labels aren't
  // truncated and keep at least 1 char of padding from both entity boxes
  // (see issue #67 — labels like "ordered in" were clamped to the fixed
  // 6-char gap and truncated to "ordere").
  const pairLabelWidth = new Map<string, number>()
  for (const rel of diagram.relationships) {
    if (!rel.label) continue
    const key = [rel.entity1, rel.entity2].sort().join('|')
    const w = maxLineWidth(rel.label)
    pairLabelWidth.set(key, Math.max(pairLabelWidth.get(key) ?? 0, w))
  }

  // --- Find connected components ---
  const components = findConnectedComponents(diagram)

  // --- Layout: place each component, then stack components vertically ---
  const placed = new Map<string, PlacedEntity>()
  let currentY = 0

  for (const component of components) {
    // Get entities in this component (preserve original order for consistency)
    const componentEntities = diagram.entities.filter((e) =>
      component.has(e.id),
    )

    // Layout entities within this component horizontally
    // Use sqrt-based row limit for larger components
    const maxPerRow = Math.max(
      2,
      Math.ceil(Math.sqrt(componentEntities.length)),
    )

    let currentX = 0
    let maxRowH = 0
    let colCount = 0

    for (let idx = 0; idx < componentEntities.length; idx++) {
      const ent = componentEntities[idx]!
      const w = mustGetEntityValue(entityBoxW, ent.id, 'box width')
      const h = mustGetEntityValue(entityBoxH, ent.id, 'box height')

      if (colCount >= maxPerRow) {
        // Wrap to next row within this component
        currentY += maxRowH + vGap
        currentX = 0
        maxRowH = 0
        colCount = 0
      }

      placed.set(ent.id, {
        entity: ent,
        sections: mustGetEntityValue(entitySections, ent.id, 'sections'),
        x: currentX,
        y: currentY,
        width: w,
        height: h,
      })

      // Widen the gap to the next entity in this row so a connecting
      // relationship's label fits with 1 char of padding on each side
      // instead of being truncated or crammed against a box border.
      let gap = hGap
      const willWrapNext = colCount + 1 >= maxPerRow
      const nextEnt = componentEntities[idx + 1]
      if (!willWrapNext && nextEnt) {
        const key = [ent.id, nextEnt.id].sort().join('|')
        const labelW = pairLabelWidth.get(key) ?? 0
        if (labelW > 0) gap = Math.max(gap, labelW + 2)
      }

      currentX += w + gap
      maxRowH = Math.max(maxRowH, h)
      colCount++
    }

    // Move to next component row (add gap between components)
    currentY += maxRowH + componentGap
  }

  // --- Create canvas ---
  let totalW = 0
  let totalH = 0
  for (const p of placed.values()) {
    totalW = Math.max(totalW, p.x + p.width)
    totalH = Math.max(totalH, p.y + p.height)
  }
  totalW += 4
  totalH += 2

  const canvas = mkCanvas(totalW - 1, totalH - 1)
  const rc = mkRoleCanvas(totalW - 1, totalH - 1)

  /**
   * Set a character on the canvas and track its role.
   * Delegates bounds-checking to the shared `write()` primitive
   * (src/ascii/canvas.ts) instead of duplicating the guard here — see
   * issue #171.
   */
  function setC(x: number, y: number, ch: string, role: CharRole): void {
    write(canvas, x, y, ch, { role, roleCanvas: rc })
  }

  // --- Draw entity boxes ---
  for (const p of placed.values()) {
    const boxCanvas = drawMultiBox(p.sections, useAscii)
    for (let bx = 0; bx < boxCanvas.length; bx++) {
      for (let by = 0; by < boxCanvas[0]!.length; by++) {
        const ch = boxCanvas[bx]![by]!
        if (ch !== ' ') {
          const cx = p.x + bx
          const cy = p.y + by
          if (cx < totalW && cy < totalH) {
            setC(cx, cy, ch, classifyBoxChar(ch))
          }
        }
      }
    }
  }

  // --- Draw relationships ---
  const H = useAscii ? '-' : '─'
  const V = useAscii ? '|' : '│'
  const dashH = useAscii ? '.' : '╌'
  const dashV = useAscii ? ':' : '┊'

  for (const rel of diagram.relationships) {
    const e1 = placed.get(rel.entity1)
    const e2 = placed.get(rel.entity2)
    if (!e1 || !e2) continue

    const lineH = rel.identifying ? H : dashH
    const lineV = rel.identifying ? V : dashV

    // Determine connection direction based on relative position.
    // Connect from right side of left entity to left side of right entity (horizontal),
    // or from bottom of upper entity to top of lower entity (vertical).
    const e1CX = e1.x + Math.floor(e1.width / 2)
    const e1CY = e1.y + Math.floor(e1.height / 2)
    const e2CX = e2.x + Math.floor(e2.width / 2)
    const e2CY = e2.y + Math.floor(e2.height / 2)

    // Check if entities are on the same row (horizontal connection)
    const sameRow = Math.abs(e1CY - e2CY) < Math.max(e1.height, e2.height)

    if (sameRow) {
      // Horizontal connection: right side of left entity → left side of right entity
      const [left, right] = e1CX < e2CX ? [e1, e2] : [e2, e1]
      const [leftCard, rightCard] =
        e1CX < e2CX
          ? [rel.cardinality1, rel.cardinality2]
          : [rel.cardinality2, rel.cardinality1]

      const startX = left.x + left.width
      const endX = right.x - 1
      const lineY = left.y + Math.floor(left.height / 2)

      // Draw horizontal line
      for (let x = startX; x <= endX; x++) {
        setC(x, lineY, lineH, 'line')
      }

      // Crow's-foot markers sit flush against each entity border (standard
      // ER notation draws the tick/circle cluster touching the entity, not
      // floating in the middle of the connecting line). Only the *label*
      // gets an inset from the border (issue #67 — labels crammed flush
      // against a box were hard to read); insetting the markers too, as a
      // prior fix did, left a 1-cell run of the plain connecting-line
      // character between the border and the marker. That fill cell uses
      // the exact same glyph as the "one" cardinality marker ('│'/'|'), so
      // it read as a stray, unexplained connector glyph floating next to
      // the real marker — see issue #351.
      const gapWidth = endX - startX + 1
      const labelInset = gapWidth >= 3 ? 1 : 0
      const markerStartX = startX
      const markerEndX = endX

      // Draw crow's foot markers at endpoints
      // Left marker (at left entity's right edge) - isRight=false
      const leftChars = getCrowsFootChars(leftCard, useAscii, false)
      for (let i = 0; i < leftChars.length; i++) {
        setC(markerStartX + i, lineY, leftChars[i]!, 'arrow')
      }

      // Right marker (at right entity's left edge) - isRight=true
      const rightChars = getCrowsFootChars(rightCard, useAscii, true)
      for (let i = 0; i < rightChars.length; i++) {
        setC(
          markerEndX - rightChars.length + 1 + i,
          lineY,
          rightChars[i]!,
          'arrow',
        )
      }

      // Relationship label centered in the gap between the two entities, below the line.
      // Clamp label to the padded gap region [startX + inset, endX - inset] so it
      // never touches a box border. Supports multi-line labels. The gap itself is
      // widened during layout (see pairLabelWidth) so the full label always fits.
      if (rel.label) {
        const lines = splitLines(rel.label)
        const gapMid = Math.floor((startX + endX) / 2)
        const labelMinX = startX + labelInset
        const labelMaxX = endX - labelInset

        // Place lines below the relationship line (lineY + 1, lineY + 2, ...)
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          const line = lines[lineIdx]!
          // Grid cells, not code units — see toDisplayCells.
          const cells = toDisplayCells(line)
          const labelStart = Math.max(
            labelMinX,
            gapMid - Math.floor(cells.length / 2),
          )
          const labelY = lineY + 1 + lineIdx
          // Ensure canvas is tall enough
          increaseSize(
            canvas,
            Math.max(labelStart + cells.length, 1),
            Math.max(labelY + 1, 1),
          )
          increaseRoleCanvasSize(
            rc,
            Math.max(labelStart + cells.length, 1),
            Math.max(labelY + 1, 1),
          )
          for (let i = 0; i < cells.length; i++) {
            const lx = labelStart + i
            if (lx >= labelMinX && lx <= labelMaxX) {
              setC(lx, labelY, cells[i]!, 'text')
            }
          }
        }
      }
    } else {
      // Vertical connection: bottom of upper entity → top of lower entity
      const [upper, lower] = e1CY < e2CY ? [e1, e2] : [e2, e1]
      const [upperCard, lowerCard] =
        e1CY < e2CY
          ? [rel.cardinality1, rel.cardinality2]
          : [rel.cardinality2, rel.cardinality1]

      const startY = upper.y + upper.height
      const endY = lower.y - 1
      const lineX = upper.x + Math.floor(upper.width / 2)

      // Vertical line
      for (let y = startY; y <= endY; y++) {
        setC(lineX, y, lineV, 'line')
      }

      // If horizontal offset needed, add a horizontal segment
      const lowerCX = lower.x + Math.floor(lower.width / 2)
      let midY = Math.floor((startY + endY) / 2)
      if (lineX !== lowerCX) {
        // Horizontal segment at midY
        const lx = Math.min(lineX, lowerCX)
        const rx = Math.max(lineX, lowerCX)
        // The label (drawn below, once midY is chosen) always sits to the
        // right of the stem at lineX + 2, regardless of which way the jog
        // itself goes — so for a leftward jog (rx === lineX) the label span
        // falls entirely outside [lx, rx], and even a rightward jog isn't
        // guaranteed to reach far enough right to cover it. Widen the
        // occupancy check (not the drawn jog segment itself) to include
        // that span whenever there's a label, or the row chosen here could
        // still get silently overwritten by this same relationship's own
        // label a few lines down.
        const labelEndX = rel.label ? lineX + 1 + maxLineWidth(rel.label) : rx
        // Pick a jog row that isn't already occupied by another entity box
        // or another relationship's already-drawn segment (issue #351 —
        // every jog previously used the same geometric midpoint regardless
        // of what else shared that row, so unrelated relationships between
        // the same two component rows collided into one garbled run, and a
        // jog could cut straight across an unrelated entity's box). `lineX`
        // is excluded from the occupancy check because this relationship's
        // own vertical stem already fills that whole column (see the loop
        // above) — that expected self-overlap isn't a collision.
        midY = chooseFreeRow(
          canvas,
          startY,
          endY,
          lx,
          Math.max(rx, labelEndX),
          lineX,
        )
        for (let x = lx; x <= rx; x++) {
          setC(x, midY, lineH, 'line')
        }
        // Vertical from midY to lower entity
        for (let y = midY + 1; y <= endY; y++) {
          setC(lowerCX, y, lineV, 'line')
        }
      } else if (rel.label) {
        // No jog needed (upper and lower entities already share a column),
        // but a label is still drawn to the right of the stem at `midY`
        // (below) — that label is text, not part of this relationship's own
        // line, so it needs the same collision check a jog's row gets:
        // without it, a straight-through relationship's label could land on
        // a row another relationship already used for its own jog (see
        // issue #351 — reproduced by three entities where two independent
        // relationships both terminate below the same row).
        const labelWidth = maxLineWidth(rel.label)
        midY = chooseFreeRow(
          canvas,
          startY,
          endY,
          lineX + 2,
          lineX + 1 + labelWidth,
          lineX,
        )
      }

      // Crow's-foot markers sit flush against each entity border, matching
      // the horizontal-connection markers above — see issue #351. (No
      // separate label inset is needed here: the vertical label, below,
      // never clamped to an inset range in the first place.)
      const markerStartY = startY
      const markerEndY = endY

      // Crow's foot markers (vertical direction)
      // Upper marker (at upper entity's bottom edge) - treat as source side (isRight=false)
      const upperChars = getCrowsFootChars(upperCard, useAscii, false)
      for (let i = 0; i < upperChars.length; i++) {
        setC(
          lineX - Math.floor(upperChars.length / 2) + i,
          markerStartY,
          upperChars[i]!,
          'arrow',
        )
      }

      // Lower marker (at lower entity's top edge) - treat as target side (isRight=true)
      const targetX = lineX !== lowerCX ? lowerCX : lineX
      const lowerChars = getCrowsFootChars(lowerCard, useAscii, true)
      for (let i = 0; i < lowerChars.length; i++) {
        setC(
          targetX - Math.floor(lowerChars.length / 2) + i,
          markerEndY,
          lowerChars[i]!,
          'arrow',
        )
      }

      // Relationship label — placed to the right of the vertical line at the
      // jog row computed above (or the geometric midpoint when there's no
      // jog), so a labeled relationship's text lands on the same row as its
      // own horizontal segment instead of a separately-computed row that
      // could drift onto an unrelated line (issue #351). We expand the
      // canvas as needed since labels can extend beyond the initial bounds.
      // Supports multi-line labels.
      if (rel.label) {
        const lines = splitLines(rel.label)
        // Center lines vertically around midY
        const startLabelY = midY - Math.floor((lines.length - 1) / 2)

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          const line = lines[lineIdx]!
          const labelX = lineX + 2
          const y = startLabelY + lineIdx
          if (y >= 0) {
            // Grid cells, not code units — see toDisplayCells.
            const cells = toDisplayCells(line)
            for (let i = 0; i < cells.length; i++) {
              const lx = labelX + i
              if (lx >= 0) {
                increaseSize(canvas, lx + 1, y + 1)
                increaseRoleCanvasSize(rc, lx + 1, y + 1)
                setC(lx, y, cells[i]!, 'text')
              }
            }
          }
        }
      }
    }
  }

  return canvasToString(canvas, { roleCanvas: rc, colorMode, theme })
}
