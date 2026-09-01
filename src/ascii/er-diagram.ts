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
import type { AsciiConfig, CharRole, AsciiTheme, ColorMode } from './types.ts'
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
  const componentGap = 6 // vertical gap between disconnected components

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

  // --- Snapshot cells occupied by entity boxes ---
  // Taken once, right after boxes are drawn and before any relationship
  // line, crow's-foot marker, or label is drawn, so relationship rendering
  // can never silently overwrite a box border or attribute text (issue
  // #350). The obstruction-aware routing below (see `obstructionBottom` and
  // the vertical row-band clamp) avoids these cells in the common cases;
  // this snapshot is the last-resort guarantee for whatever routing doesn't
  // anticipate.
  const boxCells = new Set<string>()
  for (const p of placed.values()) {
    for (let by = 0; by < p.height; by++) {
      for (let bx = 0; bx < p.width; bx++) {
        boxCells.add(`${p.x + bx},${p.y + by}`)
      }
    }
  }

  /**
   * Like setC, but refuses to draw into a cell reserved by an entity box
   * (see boxCells above). Used for every relationship line, crow's-foot
   * marker, and label write below, so a mis-routed segment degrades to a
   * gap in the line rather than corrupting a box's border or attribute
   * text.
   */
  function setCGuarded(x: number, y: number, ch: string, role: CharRole): void {
    if (boxCells.has(`${x},${y}`)) return
    // Two relationship lines are allowed to cross (a normal, expected part
    // of ER layout), but a later relationship's line/marker must not punch
    // through an earlier relationship's already-placed label text — that's
    // the same silent-corruption shape as issue #350, just between two
    // relationships instead of a relationship and a box.
    if (role !== 'text' && rc[x]?.[y] === 'text') return
    setC(x, y, ch, role)
  }

  /**
   * True when every cell in the rectangle [xStart, xEnd] x [yStart, yEnd] is
   * still blank — i.e. neither an entity box (see boxCells) nor a
   * previously-drawn relationship line/marker/label occupies it. Used to
   * pick a detour row for one relationship that doesn't land on top of
   * another relationship's already-drawn line or label (both routed through
   * the same row-gap band can otherwise silently overwrite each other).
   * Reads directly from `canvas` rather than boxCells, since it must also
   * see ink from relationships drawn earlier in this same loop.
   */
  function regionClear(
    xStart: number,
    xEnd: number,
    yStart: number,
    yEnd: number,
  ): boolean {
    for (let y = yStart; y <= yEnd; y++) {
      for (let x = xStart; x <= xEnd; x++) {
        const ch = canvas[x]?.[y]
        if (ch !== undefined && ch !== ' ') return false
      }
    }
    return true
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

      // A straight line at lineY only stays clear of other boxes when left
      // and right are actually adjacent in the row. When some other entity
      // in the same row sits between them (e.g. ORDER↔SHIPMENT with
      // LINE_ITEM placed in between — issue #350), the direct path runs
      // straight through that entity's box. Detect that case by checking
      // for any other row-mate whose x-range overlaps the gap.
      let obstructionBottom: number | undefined
      for (const other of placed.values()) {
        if (other === left || other === right) continue
        if (other.y !== left.y) continue
        const overlapsGap = other.x < endX + 1 && other.x + other.width > startX
        if (overlapsGap) {
          obstructionBottom = Math.max(
            obstructionBottom ?? 0,
            other.y + other.height,
          )
        }
      }

      // Inset the crow's foot markers by 1 cell from each entity box so
      // nothing sits flush against a border (issue #67). The line character
      // still fills the inset cell, so the connection stays visually
      // continuous. These stay anchored to each box's own edge regardless
      // of whether the path in between is direct or detoured.
      const gapWidth = endX - startX + 1
      const inset = gapWidth >= 3 ? 1 : 0
      const markerStartX = startX + inset
      const markerEndX = endX - inset

      let labelBaseY: number

      if (obstructionBottom === undefined) {
        // Direct path: nothing sits between left and right in this row.
        for (let x = startX; x <= endX; x++) {
          setCGuarded(x, lineY, lineH, 'line')
        }
        labelBaseY = lineY + 1

        // Two relationships between the exact same adjacent pair (a
        // parallel/multi edge) both compute this identical row — without
        // this search, the second relationship's label would silently
        // overwrite the first's, since setCGuarded only guards a
        // non-text write against existing text, not text-over-text.
        // Search downward, within the row-gap band, for a row where the
        // label is still on blank canvas.
        if (rel.label) {
          const labelMinX = startX + inset
          const labelMaxX = endX - inset
          const labelRows = splitLines(rel.label).length
          const maxLabelY = lineY + 1 + Math.max(vGap - 1, 1)
          while (
            labelBaseY < maxLabelY &&
            !regionClear(
              labelMinX,
              labelMaxX,
              labelBaseY,
              labelBaseY + labelRows - 1,
            )
          ) {
            labelBaseY++
          }
        }
      } else {
        // Detour beneath the obstructing entity, through the free row-gap
        // band (vGap) that layout already reserves below every row, then
        // back up to the right entity's edge. Nothing else is ever placed
        // in that band, so it's guaranteed clear regardless of how much
        // taller the obstruction is than left/right themselves.
        const rowBottom = Math.max(
          left.y + left.height,
          right.y + right.height,
          obstructionBottom,
        )
        // Reserve room for the label too (it goes one row below the detour
        // line), and search downward for a row where both the detour line
        // and the label are still on blank canvas — another relationship
        // detoured through the same row-gap band would otherwise land on
        // the exact same row and silently overwrite this one's label.
        const labelRows = rel.label ? splitLines(rel.label).length : 0
        let detourY = rowBottom + 1
        const maxDetourY = rowBottom + Math.max(vGap * 3, 4)
        while (
          detourY < maxDetourY &&
          !regionClear(startX, endX, detourY, detourY + labelRows)
        ) {
          detourY++
        }
        // Grow the canvas before drawing — a detour can reach further down
        // than the initial component-based sizing anticipated.
        increaseSize(canvas, endX + 1, detourY + labelRows + 1)
        increaseRoleCanvasSize(rc, endX + 1, detourY + labelRows + 1)
        for (let y = lineY; y <= detourY; y++) {
          setCGuarded(startX, y, lineV, 'line')
          setCGuarded(endX, y, lineV, 'line')
        }
        for (let x = startX; x <= endX; x++) {
          setCGuarded(x, detourY, lineH, 'line')
        }
        labelBaseY = detourY + 1
      }

      // Draw crow's foot markers at endpoints
      // Left marker (at left entity's right edge) - isRight=false
      const leftChars = getCrowsFootChars(leftCard, useAscii, false)
      for (let i = 0; i < leftChars.length; i++) {
        setCGuarded(markerStartX + i, lineY, leftChars[i]!, 'arrow')
      }

      // Right marker (at right entity's left edge) - isRight=true
      const rightChars = getCrowsFootChars(rightCard, useAscii, true)
      for (let i = 0; i < rightChars.length; i++) {
        setCGuarded(
          markerEndX - rightChars.length + 1 + i,
          lineY,
          rightChars[i]!,
          'arrow',
        )
      }

      // Relationship label centered in the gap between the two entities,
      // below the line (or below the detour, when one was needed). Clamp
      // label to the padded gap region [startX + inset, endX - inset] so it
      // never touches a box border. Supports multi-line labels. The gap
      // itself is widened during layout (see pairLabelWidth) so the full
      // label always fits when the path is direct.
      if (rel.label) {
        const lines = splitLines(rel.label)
        const gapMid = Math.floor((startX + endX) / 2)
        const labelMinX = startX + inset
        const labelMaxX = endX - inset

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          const line = lines[lineIdx]!
          // Grid cells, not code units — see toDisplayCells.
          const cells = toDisplayCells(line)
          const labelStart = Math.max(
            labelMinX,
            gapMid - Math.floor(cells.length / 2),
          )
          const labelY = labelBaseY + lineIdx
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
              setCGuarded(lx, labelY, cells[i]!, 'text')
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
      const lowerCX = lower.x + Math.floor(lower.width / 2)

      /** True when column x is free of every entity box across [yStart, yEnd]. */
      function columnClearOfBoxes(
        x: number,
        yStart: number,
        yEnd: number,
      ): boolean {
        for (let y = yStart; y <= yEnd; y++) {
          if (boxCells.has(`${x},${y}`)) return false
        }
        return true
      }

      // Inset the crow's foot markers by 1 row from each entity box so the
      // glyph cluster isn't flush against the border (issue #67). Computed
      // up front (rather than only just before drawing the markers, as
      // before) because the multi-row-obstruction routing below needs to
      // jog *after* these rows, not immediately at startY/endY — otherwise
      // the marker ends up sitting past where the line already turned
      // away, disconnected from it.
      const vGapHeight = endY - startY + 1
      const vInset = vGapHeight >= 3 ? 1 : 0
      const markerStartY = startY + vInset
      const markerEndY = endY - vInset

      // The naive vertical midpoint can still sit inside a row-mate of
      // `upper` that's taller than `upper` itself, so a horizontal jog (or
      // the label, placed near the same band) at that Y would run straight
      // through that entity's box (issue #350 — e.g. `dispatches`, where
      // SHIPMENT is shorter than its row-mate LINE_ITEM). Clamp to the
      // row-gap band that's actually free of every entity: below the
      // tallest box in upper's row, and above the top of lower's row.
      const upperRowBottom = Math.max(
        ...[...placed.values()]
          .filter((p) => p.y === upper.y)
          .map((p) => p.y + p.height),
      )
      const lowerRowTop = lower.y
      const bandTop = Math.max(startY, upperRowBottom + 1)
      const bandBottom = Math.min(endY, lowerRowTop - 1)

      // [bandTop, bandBottom] — not the wider [startY, endY] — is what the
      // single-row clamp above already guarantees is clear of a row-mate of
      // `upper` (or the top of `lower`'s own row). Checking the wider range
      // here would misfire on exactly that already-handled case (a row-mate
      // taller than `upper`, e.g. STUDENT next to a shorter TEACHER) and
      // route it through the free-column bypass unnecessarily. A genuine
      // multi-row obstruction — some entity in a row strictly between
      // `upper`'s and `lower`'s own rows (e.g. A→G below, where D sits in
      // the same column as A, two rows down) — still shows up here, since
      // bandTop/bandBottom span every row in between, not just one.
      const multiRowObstruction =
        !columnClearOfBoxes(lineX, bandTop, bandBottom) ||
        !columnClearOfBoxes(lowerCX, bandTop, bandBottom)

      /**
       * Pick a row within the free row-gap band for a horizontal run across
       * [xStart, xEnd] (plus `extraRows` below it, for a multi-line label).
       * Prefers a row that's still entirely blank — not already used by
       * another relationship's line or label routed through the same band
       * (issue #350) — falling back to the midpoint of the band (or of the
       * full startY..endY span, if the band is degenerate) when nothing is
       * fully clear.
       */
      function pickBandY(
        xStart: number,
        xEnd: number,
        extraRows: number,
      ): number {
        const fallback =
          bandTop <= bandBottom
            ? Math.floor((bandTop + bandBottom) / 2)
            : Math.floor((startY + endY) / 2)
        if (bandTop > bandBottom) return fallback
        for (let y = bandTop; y <= bandBottom; y++) {
          if (regionClear(xStart, xEnd, y, y + extraRows)) return y
        }
        return fallback
      }

      // Where the visible line actually runs — lineX in the common case,
      // or the free bypass column found below when a third entity sits
      // directly in the way. The label (further down) anchors to whichever
      // one is real, instead of always assuming lineX.
      let routingX = lineX

      if (multiRowObstruction) {
        // Route around the intervening entity through a column that's
        // completely free of every box across the whole vertical span,
        // searched outward from lineX. Two short horizontal jogs — right
        // after leaving upper, right before reaching lower — connect
        // lineX/lowerCX to that column; the long middle run is a plain
        // vertical line, guaranteed not to touch any box.
        const canvasWidth = canvas.length
        let viaX: number | undefined
        for (let offset = 0; offset <= canvasWidth; offset++) {
          if (columnClearOfBoxes(lineX + offset, startY, endY)) {
            viaX = lineX + offset
            break
          }
          if (offset > 0 && columnClearOfBoxes(lineX - offset, startY, endY)) {
            viaX = lineX - offset
            break
          }
        }
        // No column anywhere on the canvas is fully clear (a very dense
        // diagram) — fall back to lineX. setCGuarded still guarantees no
        // box gets corrupted; the line just keeps the gap it already had.
        routingX = viaX ?? lineX

        // Stay on lineX/lowerCX through the marker rows (so each crow's
        // foot marker still sits on a connected line, same as the
        // non-obstructed case below), then jog over to routingX for the
        // long middle run.
        for (let y = startY; y <= markerStartY; y++) {
          setCGuarded(lineX, y, lineV, 'line')
        }
        for (
          let x = Math.min(lineX, routingX);
          x <= Math.max(lineX, routingX);
          x++
        ) {
          setCGuarded(x, markerStartY, lineH, 'line')
        }
        for (let y = markerStartY; y <= markerEndY; y++) {
          setCGuarded(routingX, y, lineV, 'line')
        }
        for (
          let x = Math.min(routingX, lowerCX);
          x <= Math.max(routingX, lowerCX);
          x++
        ) {
          setCGuarded(x, markerEndY, lineH, 'line')
        }
        for (let y = markerEndY; y <= endY; y++) {
          setCGuarded(lowerCX, y, lineV, 'line')
        }
      } else {
        // Vertical line. Column lineX stays within upper's own x-range,
        // which by layout construction never overlaps a row-mate's box, so
        // this straight run is safe regardless of how far it descends.
        for (let y = startY; y <= endY; y++) {
          setCGuarded(lineX, y, lineV, 'line')
        }

        // If horizontal offset needed, add a horizontal segment
        if (lineX !== lowerCX) {
          const lx = Math.min(lineX, lowerCX)
          const rx = Math.max(lineX, lowerCX)
          const midY = pickBandY(lx, rx, 0)

          // Horizontal segment at midY
          for (let x = lx; x <= rx; x++) {
            setCGuarded(x, midY, lineH, 'line')
          }
          // Vertical from midY to lower entity
          for (let y = midY + 1; y <= endY; y++) {
            setCGuarded(lowerCX, y, lineV, 'line')
          }
        }
      }

      // Crow's foot markers (vertical direction) — markerStartY/markerEndY
      // computed up front, above.
      // Upper marker (at upper entity's bottom edge) - treat as source side (isRight=false)
      const upperChars = getCrowsFootChars(upperCard, useAscii, false)
      for (let i = 0; i < upperChars.length; i++) {
        setCGuarded(
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
        setCGuarded(
          targetX - Math.floor(lowerChars.length / 2) + i,
          markerEndY,
          lowerChars[i]!,
          'arrow',
        )
      }

      // Relationship label — placed to the right of the vertical line,
      // within the free row-gap band. We expand the canvas as needed since
      // labels can extend beyond the initial bounds. Supports multi-line
      // labels.
      if (rel.label) {
        const lines = splitLines(rel.label)
        const labelX = routingX + 2
        const labelWidth = Math.max(
          ...lines.map((l) => toDisplayCells(l).length),
        )
        // In the multi-row-obstruction case, bandTop/bandBottom (derived
        // from upper's and lower's own immediate rows) don't describe the
        // routingX column's actual clear range — it's clear across the
        // *entire* [startY, endY] span by construction (see above), so
        // search that instead of the single-row band.
        const startLabelY = multiRowObstruction
          ? (() => {
              for (let y = startY; y <= endY; y++) {
                if (
                  regionClear(
                    labelX,
                    labelX + labelWidth - 1,
                    y,
                    y + lines.length - 1,
                  )
                )
                  return y
              }
              return Math.floor((startY + endY) / 2)
            })()
          : pickBandY(labelX, labelX + labelWidth - 1, lines.length - 1)

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          const line = lines[lineIdx]!
          const y = startLabelY + lineIdx
          if (y >= 0) {
            // Grid cells, not code units — see toDisplayCells.
            const cells = toDisplayCells(line)
            for (let i = 0; i < cells.length; i++) {
              const lx = labelX + i
              if (lx >= 0) {
                increaseSize(canvas, lx + 1, y + 1)
                increaseRoleCanvasSize(rc, lx + 1, y + 1)
                setCGuarded(lx, y, cells[i]!, 'text')
              }
            }
          }
        }
      }
    }
  }

  return canvasToString(canvas, { roleCanvas: rc, colorMode, theme })
}
