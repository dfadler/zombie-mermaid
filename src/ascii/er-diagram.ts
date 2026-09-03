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
import { DEFAULT_PADDING_X, DEFAULT_PADDING_Y, paddingOffset } from './types.ts'

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
  // See paddingOffset's doc comment (types.ts) for why these are an offset
  // from the padding defaults rather than the raw config values.
  //
  // hGap/vGap floors are higher than the generic "don't collapse to
  // nothing" minimum of 1: crow's-foot markers are up to 2 cells wide and
  // are drawn from each entity's edge inward (1-cell inset once the gap is
  // >= 3 — see the "Inset the crow's foot markers" comment below), so a
  // same-row relationship's two markers overlap unless
  // gapWidth > 3 + 2*inset — i.e. unless the gap is at least 6 cells for the
  // worst case of a 2-cell marker on each side (e.g. two "zero-many" ends).
  // A vertical relationship needs at least 2 rows so the upper and lower
  // markers don't land on the same row. (See issue #343's CodeRabbit
  // review.)
  const hGap = paddingOffset(config.paddingX, DEFAULT_PADDING_X, 6, 6) // horizontal gap between entity boxes
  const vGap = paddingOffset(config.paddingY, DEFAULT_PADDING_Y, 4, 2) // vertical gap between rows (for relationship lines)
  const componentGap = paddingOffset(config.paddingY, DEFAULT_PADDING_Y, 6, 1) // vertical gap between disconnected components

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
    const { width: boxW, height: boxH } = measureMultiBox(
      sections,
      config.boxBorderPadding,
    )

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

  /**
   * True for a cell a relationship draw must not silently overwrite: an
   * entity's own box border, or 'text' (a label or an entity's own
   * header/attribute text). Relationships are drawn in declaration order, so
   * a later relationship's line, crow's-foot marker, or label can otherwise
   * land on the exact cell an earlier one (or a plain entity box) already
   * wrote, corrupting it — a stray line glyph mid-word, one label's
   * characters spliced into another's, or (for a same-row relationship whose
   * straight line runs across an unrelated entity sitting between its two
   * endpoints) that entity's border erased outright (issue #392). This
   * doesn't fix the underlying routing gap — the line still crosses straight
   * through the box, an out-of-scope defect tracked in #351/#390's "known
   * limitation" — it only stops that crossing from destroying content.
   */
  function isProtected(x: number, y: number): boolean {
    const role = rc[x]?.[y]
    return role === 'text' || role === 'border'
  }

  /**
   * True when every cell a label's line would occupy (after clamping to
   * [minX, maxX]) is free of protected content (see isProtected). Checked as
   * a whole line rather than character-by-character: a per-character skip on
   * a *label* write (unlike a line or marker) would let two overlapping
   * labels' letters splice together into a new word that isn't either
   * original label — e.g. "has" + the tail of "tagged-with" reading as
   * "hasged-with" — which is more misleading than either label winning
   * outright or neither appearing. A label either renders intact or is
   * skipped entirely.
   */
  function canPlaceLabelLine(
    cells: string[],
    startX: number,
    y: number,
    minX: number,
    maxX: number,
  ): boolean {
    for (let i = 0; i < cells.length; i++) {
      const x = startX + i
      if (x < minX || x > maxX) continue
      if (isProtected(x, y)) return false
    }
    return true
  }

  /**
   * Like canPlaceLabelLine, but also refuses a cell already holding a
   * crow's-foot marker ('arrow'), or reserved by an entity box (see
   * boxCells, defined below — referenced here by closure, since this
   * function isn't actually called until after boxCells exists). Used only
   * when searching for an alternate row for a vertical relationship's
   * label (see below): a label's own natural row is allowed to sit on top
   * of that same relationship's freshly-drawn line (expected — the label
   * always wins over the line beneath it), but a *different* row picked
   * specifically to dodge a collision shouldn't destroy a marker it
   * happens to land on instead. The boxCells check matters most for a
   * bypass-routed relationship (#350): a box's own blank interior padding
   * never gets a role written to it, so isProtected alone would treat it
   * as free even though it's inside another entity's box.
   */
  function canPlaceLabelLineAvoidingMarkers(
    cells: string[],
    startX: number,
    y: number,
    minX: number,
    maxX: number,
  ): boolean {
    for (let i = 0; i < cells.length; i++) {
      const x = startX + i
      if (x < minX || x > maxX) continue
      if (isProtected(x, y) || rc[x]?.[y] === 'arrow') return false
      if (boxCells.has(`${x},${y}`)) return false
    }
    return true
  }

  // --- Draw entity boxes ---
  for (const p of placed.values()) {
    const boxCanvas = drawMultiBox(
      p.sections,
      useAscii,
      config.boxBorderPadding,
    )
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
   * Like setCGuarded, but for a horizontal line/dash fill: also backs off
   * one cell when either neighbor already holds 'text' (carried over from
   * the #392 fix's setRelHChar). isProtected/boxCells alone guard a
   * label's own cells, but a *different*, later-processed relationship's
   * horizontal jog — including the obstruction-detour and band-clamped
   * routing added for #350 — can still run its dashes right up against an
   * earlier one's label with zero visual gap (e.g. "────authors────").
   * Only used for horizontal fills (same-row connection line, detour
   * bottom, vertical connection's jog): a vertical '│' passing a label's
   * row doesn't read as visually cramped the same way, so it isn't padded.
   */
  function setCGuardedH(
    x: number,
    y: number,
    ch: string,
    role: CharRole,
  ): void {
    if (rc[x - 1]?.[y] === 'text' || rc[x + 1]?.[y] === 'text') return
    setCGuarded(x, y, ch, role)
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

  /**
   * Character for the single cell where a routed relationship's path turns
   * — a vertical segment and a horizontal segment meeting at a right angle
   * (issue #414). `vertDir` is the direction the vertical segment extends
   * away from this corner cell ('up' toward smaller y, 'down' toward
   * larger y); `horizDir` is the direction the horizontal segment extends
   * away from this same cell. Collapses to '+' in ASCII mode, matching
   * getCrowsFootChars' own useAscii branching.
   */
  function getCornerChar(
    vertDir: 'up' | 'down',
    horizDir: 'left' | 'right',
  ): string {
    if (useAscii) return '+'
    if (vertDir === 'down') return horizDir === 'right' ? '┌' : '┐'
    return horizDir === 'right' ? '└' : '┘'
  }

  /**
   * Draw a corner glyph at a routed relationship's turn point, through the
   * same setCGuarded occupancy guard as every other relationship write (see
   * setCGuarded's doc comment above), so a corner can never overwrite an
   * entity box border or another relationship's already-placed label text
   * — the same corruption shape #391 fixed for plain line/marker writes.
   * Called after the plain line segments (and, in the multi-row-bypass
   * case, before the crow's-foot markers) are drawn, so the corner glyph
   * replaces whichever line/dash character would otherwise occupy that one
   * cell where the path actually changes direction.
   */
  function drawCorner(
    x: number,
    y: number,
    vertDir: 'up' | 'down',
    horizDir: 'left' | 'right',
  ): void {
    setCGuarded(x, y, getCornerChar(vertDir, horizDir), 'line')
  }

  /**
   * Attachment columns for vertical (different-row) relationships, keyed by
   * entity id, one bucket per edge the relationship attaches to. Without
   * this, every vertical relationship's marker independently defaults to
   * its entity's exact horizontal center — so when two or more
   * relationships converge on the *same* entity's top edge (or leave from
   * the same bottom edge) — e.g. USER→COMMENT and POST→COMMENT both ending
   * at COMMENT — their markers land on the identical cell and read as one
   * merged crow's-foot instead of two distinguishable relationships (issue
   * #453). Real mermaid.js avoids this by staggering each edge's
   * attachment point along the entity's border based on where the other
   * endpoint sits; `attachmentX` below mirrors that by spreading multiple
   * attachments left-to-right across the entity's own width, ordered by the
   * other entity's center X (so the visual left-to-right order of the
   * relationships matches the left-to-right order of their sources).
   * Entities with only one attachment on a given side are unaffected — they
   * still resolve to dead center, exactly as before this change.
   */
  interface VerticalAttachment {
    rel: (typeof diagram.relationships)[number]
    otherCenterX: number
  }
  const topAttachments = new Map<string, VerticalAttachment[]>()
  const bottomAttachments = new Map<string, VerticalAttachment[]>()
  for (const rel of diagram.relationships) {
    const e1 = placed.get(rel.entity1)
    const e2 = placed.get(rel.entity2)
    if (!e1 || !e2) continue
    const e1CY = e1.y + Math.floor(e1.height / 2)
    const e2CY = e2.y + Math.floor(e2.height / 2)
    const sameRow = Math.abs(e1CY - e2CY) < Math.max(e1.height, e2.height)
    if (sameRow) continue
    const [upperE, lowerE] = e1CY < e2CY ? [e1, e2] : [e2, e1]
    const upperCX = upperE.x + Math.floor(upperE.width / 2)
    const lowerCX = lowerE.x + Math.floor(lowerE.width / 2)
    let bottomList = bottomAttachments.get(upperE.entity.id)
    if (!bottomList) {
      bottomList = []
      bottomAttachments.set(upperE.entity.id, bottomList)
    }
    bottomList.push({ rel, otherCenterX: lowerCX })
    let topList = topAttachments.get(lowerE.entity.id)
    if (!topList) {
      topList = []
      topAttachments.set(lowerE.entity.id, topList)
    }
    topList.push({ rel, otherCenterX: upperCX })
  }

  /**
   * Resolve the attachment column for `rel` on `entity`'s given side. Falls
   * back to dead center when that side has zero or one attachment (the
   * common case, and the pre-#453 behavior). With two or more, spreads them
   * evenly across the entity's own width — inset by 1 cell from each edge
   * so a 2-cell-wide crow's-foot marker (e.g. "zero-many") doesn't sit
   * flush against a box corner — ordered by the other entity's center X.
   */
  function attachmentX(
    entity: PlacedEntity,
    rel: (typeof diagram.relationships)[number],
    attachments: Map<string, VerticalAttachment[]>,
  ): number {
    const list = attachments.get(entity.entity.id)
    const centerX = entity.x + Math.floor(entity.width / 2)
    if (!list || list.length <= 1) return centerX
    const sorted = [...list].sort((a, b) => a.otherCenterX - b.otherCenterX)
    const idx = sorted.findIndex((a) => a.rel === rel)
    if (idx === -1) return centerX
    const margin = Math.min(1, Math.floor((entity.width - 1) / 2))
    const usableWidth = Math.max(0, entity.width - 1 - margin * 2)
    const step = sorted.length > 1 ? usableWidth / (sorted.length - 1) : 0
    return entity.x + margin + Math.round(idx * step)
  }

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
          setCGuardedH(x, lineY, lineH, 'line')
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
          setCGuardedH(x, detourY, lineH, 'line')
        }
        // Mark the two points where the detour actually turns — straight
        // down from the row, then straight across, then straight back up —
        // so the turn reads as one continuous line rather than a line
        // ending flush against an unrelated mark (issue #414).
        if (startX !== endX) {
          drawCorner(startX, detourY, 'up', 'right')
          drawCorner(endX, detourY, 'up', 'left')
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
          if (
            !canPlaceLabelLine(cells, labelStart, labelY, labelMinX, labelMaxX)
          ) {
            continue
          }
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
      // Dead center when this entity has only one relationship attaching
      // to this side; otherwise staggered so it doesn't collide with a
      // sibling relationship's marker on the same edge (issue #453).
      const lineX = attachmentX(upper, rel, bottomAttachments)
      const lowerCX = attachmentX(lower, rel, topAttachments)

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
          setCGuardedH(x, markerStartY, lineH, 'line')
        }
        for (let y = markerStartY; y <= markerEndY; y++) {
          setCGuarded(routingX, y, lineV, 'line')
        }
        for (
          let x = Math.min(routingX, lowerCX);
          x <= Math.max(routingX, lowerCX);
          x++
        ) {
          setCGuardedH(x, markerEndY, lineH, 'line')
        }
        for (let y = markerEndY; y <= endY; y++) {
          setCGuarded(lowerCX, y, lineV, 'line')
        }
        // Mark the bypass's four turns (issue #414). Drawn before the
        // crow's-foot markers below, so a marker centered on the same
        // column/row still wins where the two coincide — same precedence
        // as before this change, when the marker overwrote a plain line
        // character there instead of a corner.
        if (lineX !== routingX) {
          const horizDirAtLine = routingX > lineX ? 'right' : 'left'
          const horizDirAtRouting =
            horizDirAtLine === 'right' ? 'left' : 'right'
          drawCorner(lineX, markerStartY, 'up', horizDirAtLine)
          drawCorner(routingX, markerStartY, 'down', horizDirAtRouting)
        }
        if (routingX !== lowerCX) {
          const horizDirAtRouting2 = lowerCX > routingX ? 'right' : 'left'
          const horizDirAtLower =
            horizDirAtRouting2 === 'right' ? 'left' : 'right'
          drawCorner(routingX, markerEndY, 'up', horizDirAtRouting2)
          drawCorner(lowerCX, markerEndY, 'down', horizDirAtLower)
        }
      } else {
        // Vertical line. Column lineX stays within upper's own x-range,
        // which by layout construction never overlaps a row-mate's box, so
        // this straight run is safe regardless of how far it descends. When
        // a horizontal jog is needed below, though, the path redirects to
        // lowerCX at the jog row — so this initial fill must stop *before*
        // that row rather than always running the full height. Otherwise a
        // leftover remnant keeps drawing all the way to endY at the
        // original lineX, a stray parallel line beside the actual jogged
        // path that connects to nothing (issue #392).
        const needsJog = lineX !== lowerCX
        const lx = Math.min(lineX, lowerCX)
        const rx = Math.max(lineX, lowerCX)
        const midY = needsJog ? pickBandY(lx, rx, 0) : endY
        const initialVertEnd = needsJog ? midY - 1 : endY
        for (let y = startY; y <= initialVertEnd; y++) {
          setCGuarded(lineX, y, lineV, 'line')
        }

        // If horizontal offset needed, add a horizontal segment
        if (needsJog) {
          // Horizontal segment at midY
          for (let x = lx; x <= rx; x++) {
            setCGuardedH(x, midY, lineH, 'line')
          }
          // Vertical from midY to lower entity
          for (let y = midY + 1; y <= endY; y++) {
            setCGuarded(lowerCX, y, lineV, 'line')
          }
          // Mark the jog's two turns (issue #414): the vertical run from
          // upper arrives from above and turns toward lowerCX; the
          // vertical run into lower departs downward, having turned away
          // from lineX.
          const horizDirAtLine = lowerCX > lineX ? 'right' : 'left'
          const horizDirAtLower = horizDirAtLine === 'right' ? 'left' : 'right'
          drawCorner(lineX, midY, 'up', horizDirAtLine)
          drawCorner(lowerCX, midY, 'down', horizDirAtLower)
          // The path now ends at lowerCX, not lineX — the lower marker and
          // label (below) must anchor there too, or they render visually
          // disconnected from the line that actually reaches them (#392).
          routingX = lowerCX
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

      // Relationship label — placed to the right of the vertical line.
      // Anchored to routingX, not lineX/targetX: when the connection was
      // detoured around an obstructing entity (#350), or jogged over to
      // the lower entity's own column, the label needs to sit next to
      // wherever the line actually ends up, not next to the relationship's
      // original upper-entity column — otherwise it renders visually
      // disconnected, floating in the gap between the two. We expand the
      // canvas as needed since labels can extend beyond the initial
      // bounds. Supports multi-line labels.
      if (rel.label) {
        const lines = splitLines(rel.label)
        const labelX = routingX + 2
        const cellsPerLine = lines.map((line) => toDisplayCells(line))
        const maxCells = Math.max(...cellsPerLine.map((cells) => cells.length))
        const lastLx = labelX + maxCells - 1
        const blockHeight = lines.length
        const midY = Math.floor((startY + endY) / 2)
        const naturalStartY = midY - Math.floor((blockHeight - 1) / 2)

        if (lastLx >= 0) {
          increaseSize(canvas, lastLx + 1, endY + 1)
          increaseRoleCanvasSize(rc, lastLx + 1, endY + 1)
        }

        // Multiple vertical relationships sharing the same upper/lower
        // entity "rows" in the grid layout end up with the identical
        // startY/endY — and so the identical natural midY — for their own
        // labels. Without ever considering another row, only the first of
        // them to draw would keep its label; the rest would find their
        // natural row already taken and drop out entirely, even though
        // there's room a row or two away. Try the natural row first, then
        // scan outward (alternating below/above) within the relationship's
        // own vertical run for the nearest row where the whole label fits
        // cleanly. "Fits" means clear of every entity box (see boxCells) —
        // not just text/border content already drawn — since a box's own
        // blank interior padding never gets a role written to it and would
        // otherwise look free; a bypass-routed relationship (routingX) can
        // legitimately run its label past a box that never touched
        // startY/endY's naive band (#350). It also means clear of markers,
        // not just text/borders (#392) — before giving up.
        let placedAtY: number | null = null
        for (
          let offset = 0;
          offset <= endY - startY && placedAtY === null;
          offset++
        ) {
          const candidates =
            offset === 0
              ? [naturalStartY]
              : [naturalStartY + offset, naturalStartY - offset]
          for (const candidateStart of candidates) {
            if (
              candidateStart < startY ||
              candidateStart + blockHeight - 1 > endY
            ) {
              continue
            }
            const fits = cellsPerLine.every((cells, lineIdx) =>
              canPlaceLabelLineAvoidingMarkers(
                cells,
                labelX,
                candidateStart + lineIdx,
                0,
                lastLx,
              ),
            )
            if (fits) {
              placedAtY = candidateStart
              break
            }
          }
        }

        if (placedAtY !== null) {
          for (let lineIdx = 0; lineIdx < blockHeight; lineIdx++) {
            const cells = cellsPerLine[lineIdx]!
            const y = placedAtY + lineIdx
            for (let i = 0; i < cells.length; i++) {
              const lx = labelX + i
              if (lx >= 0) {
                setCGuarded(lx, y, cells[i]!, 'text')
              }
            }
            // A relationship's own jog can leave a line character
            // immediately beside where its own label starts —
            // setCGuardedH only stops a *different*, later write from
            // crowding an already-placed label; it can't retroactively
            // clean up a dash this same relationship left right there
            // moments earlier, before the label existed to protect
            // against it. Clear one cell of breathing room on each side
            // whenever a line glyph (from any relationship) is sitting
            // there.
            if (rc[labelX - 1]?.[y] === 'line') {
              setC(labelX - 1, y, ' ', 'line')
            }
            const afterX = labelX + cells.length
            if (rc[afterX]?.[y] === 'line') {
              setC(afterX, y, ' ', 'line')
            }
          }
        }
      }
    }
  }

  return canvasToString(canvas, { roleCanvas: rc, colorMode, theme })
}
