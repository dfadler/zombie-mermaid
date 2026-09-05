// ============================================================================
// ASCII renderer — class diagrams
//
// Renders classDiagram text to ASCII/Unicode art.
// Each class is a multi-compartment box (header | attributes | methods).
// Relationships are drawn as lines between classes with UML markers.
//
// Layout: level-based top-down. "From" classes are placed above "to" classes
// for all relationship types, matching ELK/mermaid.com behavior.
// Relationship lines use simple Manhattan routing (vertical + horizontal).
// ============================================================================

import { parseClassDiagram } from '../class/parser.ts'
import { formatClassMember } from '../class/format.ts'
import type { ClassNode, RelationshipType } from '../class/types.ts'
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
import { splitLines } from './multiline-utils.ts'
import { splitStatements } from '../statements.ts'
import { displayWidth, toDisplayCells } from './display-width.ts'
import { DEFAULT_PADDING_X, DEFAULT_PADDING_Y, paddingOffset } from './types.ts'

/** Build the text sections for a class box: [header], [attributes], [methods] */
function buildClassSections(cls: ClassNode): string[][] {
  // Header section: optional annotation + class name (may be multi-line)
  const header: string[] = []
  if (cls.annotation) header.push(`<<${cls.annotation}>>`)
  // Support multi-line class names
  const nameLines = splitLines(cls.label)
  header.push(...nameLines)

  // Attributes section
  const attrs = cls.attributes.map(formatClassMember)

  // Methods section
  const methods = cls.methods.map(formatClassMember)

  // Build sections from only the non-empty parts. Only attrs (2-section),
  // only methods (2-section), both (3-section), or neither (1-section, header only).
  const sections: string[][] = [header]
  if (attrs.length > 0) sections.push(attrs)
  if (methods.length > 0) sections.push(methods)
  return sections
}

// ============================================================================
// Relationship marker characters
// ============================================================================

interface RelMarker {
  /** Relationship type (determines marker shape) */
  type: RelationshipType
  /** Which end the marker is placed at */
  markerAt: 'from' | 'to'
  /** Whether the line is dashed */
  dashed: boolean
}

/**
 * Build the marker metadata for a relationship.
 * The actual marker character will be determined at placement time based on line direction.
 */
function getRelMarker(
  type: RelationshipType,
  markerAt: 'from' | 'to',
): RelMarker {
  const dashed = type === 'dependency' || type === 'realization'
  return { type, markerAt, dashed }
}

/**
 * Get the UML marker shape character for a relationship type.
 * For directional arrows (association/dependency), the direction parameter
 * specifies which way the arrow should point.
 */
function getMarkerShape(
  type: RelationshipType,
  useAscii: boolean,
  direction?: 'up' | 'down' | 'left' | 'right',
): string {
  switch (type) {
    case 'inheritance':
    case 'realization':
      // Hollow triangle - rotate based on line direction
      // Triangle points TOWARD the parent class
      if (direction === 'down') {
        // Line goes down (parent above, child below) - triangle points UP
        return useAscii ? '^' : '△'
      } else if (direction === 'up') {
        // Line goes up (parent below, child above) - triangle points DOWN
        return useAscii ? 'v' : '▽'
      } else if (direction === 'left') {
        // Line goes left - triangle points LEFT
        return useAscii ? '>' : '◁'
      } else {
        // Default: line goes right - triangle points RIGHT
        return useAscii ? '<' : '▷'
      }
    case 'composition':
      // Filled diamond - omnidirectional shape
      return useAscii ? '*' : '◆'
    case 'aggregation':
      // Hollow diamond - omnidirectional shape
      return useAscii ? 'o' : '◇'
    case 'association':
    case 'dependency':
      // Directional arrow - rotate based on line direction
      if (direction === 'down') {
        return useAscii ? 'v' : '▼'
      } else if (direction === 'up') {
        return useAscii ? '^' : '▲'
      } else if (direction === 'left') {
        return useAscii ? '<' : '◀'
      } else {
        // Default to right (or when direction not specified)
        return useAscii ? '>' : '▶'
      }
  }
}

/**
 * Clip a relationship label's padded display cells to fit within
 * [writableStart, writableEnd] — the room that's actually free on its row
 * before it would collide with a *different* relationship's label that a
 * previous iteration already drew there (see the call site in
 * `renderClassAscii` for how that room is computed).
 *
 * Deliberately clips in place rather than re-centering into the available
 * window: shifting a label's anchor to dodge a collision can push it
 * further right than its natural centered position, which then collides
 * with the *next* relationship's rightful space and cascades into
 * dropping labels entirely — this happened while fixing issue #447 (a
 * label pinned near the left canvas edge, itself already clamped rightward
 * by `Math.max(0, idealLabelStart)`, swallowed its neighbor's whole ideal
 * column). Truncated text gets an ellipsis on whichever side got clipped;
 * the label's own padding spaces are dropped first since they're the least
 * meaningful thing to lose.
 */
function fitLabelToAvailableWidth(
  naturalStart: number,
  naturalCells: string[],
  text: string,
  writableStart: number,
  writableEnd: number,
): { start: number; cells: string[] } {
  const naturalEnd = naturalStart + naturalCells.length - 1
  const clippedLeft = writableStart > naturalStart
  const clippedRight = writableEnd < naturalEnd
  if (!clippedLeft && !clippedRight) {
    return { start: naturalStart, cells: naturalCells }
  }

  // Only the side(s) that actually collided move inward — an unclipped
  // side keeps its natural bound. Using the raw `writableStart`/
  // `writableEnd` for *both* sides here (even the uncollided one) would
  // center the shrunk label inside the entire remaining canvas rather
  // than snug against its own natural extent, drifting it away from its
  // own relationship and into a completely different one's territory.
  const effectiveStart = clippedLeft ? writableStart : naturalStart
  const effectiveEnd = clippedRight ? writableEnd : naturalEnd
  const availableCols = Math.max(0, effectiveEnd - effectiveStart + 1)
  const ellipsisCount = (clippedLeft ? 1 : 0) + (clippedRight ? 1 : 0)

  if (availableCols === 0) return { start: effectiveStart, cells: [] }
  if (availableCols < ellipsisCount) {
    // Not even room for both ellipsis markers — show a single one rather
    // than nothing, so a squeezed-out label still leaves a visible trace.
    return { start: effectiveStart, cells: ['…'] }
  }

  const innerWidth = Math.max(0, availableCols - ellipsisCount)
  const textCells = toDisplayCells(text)
  const kept =
    textCells.length <= innerWidth
      ? textCells
      : clippedLeft && !clippedRight
        ? textCells.slice(textCells.length - innerWidth) // keep the tail
        : textCells.slice(0, innerWidth) // keep the head

  const cells = [
    ...(clippedLeft ? ['…'] : []),
    ...kept,
    ...(clippedRight ? ['…'] : []),
  ]
  // Center the shrunk label within the writable window so it still reads
  // near the relationship it belongs to, rather than hugging one edge.
  const start =
    effectiveStart + Math.max(0, Math.floor((availableCols - cells.length) / 2))
  return { start, cells }
}

// ============================================================================
// Layout and rendering
// ============================================================================

/** Positioned class node on the canvas */
interface PlacedClass {
  cls: ClassNode
  sections: string[][]
  x: number
  y: number
  width: number
  height: number
}

/**
 * Render a Mermaid class diagram to ASCII/Unicode text.
 *
 * Pipeline: parse → build boxes → level-based layout → draw boxes → draw relationships → string.
 */
export function renderClassAscii(
  text: string,
  config: AsciiConfig,
  colorMode?: ColorMode,
  theme?: AsciiTheme,
): string {
  const lines = splitStatements(text)
  const diagram = parseClassDiagram(lines)

  if (diagram.classes.length === 0) return ''

  const useAscii = config.useAscii
  // See paddingOffset's doc comment (types.ts) for why these are an offset
  // from the padding defaults rather than the raw config values.
  const hGap = paddingOffset(config.paddingX, DEFAULT_PADDING_X, 4, 1) // horizontal gap between class boxes
  const vGap = paddingOffset(config.paddingY, DEFAULT_PADDING_Y, 3, 1) // vertical gap between levels (enough for relationship lines)

  // --- Build box dimensions for each class ---
  const classSections = new Map<string, string[][]>()
  const classBoxW = new Map<string, number>()
  const classBoxH = new Map<string, number>()

  for (const cls of diagram.classes) {
    const sections = buildClassSections(cls)
    classSections.set(cls.id, sections)

    // Reserve exactly what drawMultiBox will draw — measuring it here rather
    // than re-deriving the arithmetic keeps layout and drawing in lockstep for
    // wide-character (CJK/fullwidth) content.
    const { width: boxW, height: boxH } = measureMultiBox(
      sections,
      config.boxBorderPadding,
    )

    classBoxW.set(cls.id, boxW)
    classBoxH.set(cls.id, boxH)
  }

  // --- Assign levels: topological sort based on directed relationships ---
  // All relationship types place "from" above "to" in the layout, matching
  // ELK's layered algorithm and the official mermaid.com renderer behavior.
  // For "Animal <|-- Dog": from="Animal", to="Dog" → Animal above Dog.
  //
  // Every relationship type (including association and dependency) forces nodes
  // to different levels. Same-row routing for mixed diagrams causes collisions:
  // detour lines overlap with cross-level routing, and labels overwrite box borders.

  const classById = new Map<string, ClassNode>()
  for (const cls of diagram.classes) classById.set(cls.id, cls)

  const parents = new Map<string, Set<string>>() // child → set of parent IDs
  const children = new Map<string, Set<string>>() // parent → set of child IDs

  for (const rel of diagram.relationships) {
    // Level assignment always places "from" above "to", for every relationship
    // type — including inheritance and realization — matching real mermaid.js's
    // layout. This is independent of which end carries the UML marker glyph
    // (`rel.markerAt`, used only to orient the arrowhead when drawing the line
    // below); e.g. `Bird ..|> Flyable` (markerAt='to') places Bird above
    // Flyable even though the hollow-triangle marker touches Flyable. See
    // issue #446 — this used to special-case inheritance/realization to put
    // whichever end held the marker on top, which produced the correct order
    // for `<|--` (where marker happens to be at 'from') but reversed it for
    // `..|>` (where marker is at 'to').
    const parentId = rel.from
    const childId = rel.to

    const parentSet = parents.get(childId) ?? new Set<string>()
    parents.set(childId, parentSet)
    parentSet.add(parentId)
    const childSet = children.get(parentId) ?? new Set<string>()
    children.set(parentId, childSet)
    childSet.add(childId)
  }

  // BFS from roots (classes that have no parents) to assign levels.
  // Cap at classes.length - 1 to prevent infinite loops on cyclic graphs
  // (e.g. View --> Model and Model ..> View would otherwise push levels
  // upward forever). In a DAG the longest path has at most N-1 edges.
  const level = new Map<string, number>()
  const roots = diagram.classes.filter(
    (c) => !parents.has(c.id) || parents.get(c.id)!.size === 0,
  )
  const queue: string[] = roots.map((c) => c.id)
  for (const id of queue) level.set(id, 0)

  const levelCap = diagram.classes.length - 1
  let qi = 0
  while (qi < queue.length) {
    const id = queue[qi++]!
    const childSet = children.get(id)
    if (!childSet) continue
    for (const childId of childSet) {
      const newLevel = (level.get(id) ?? 0) + 1
      if (newLevel > levelCap) continue // cycle detected — skip to prevent infinite loop
      if (!level.has(childId) || level.get(childId)! < newLevel) {
        level.set(childId, newLevel)
        queue.push(childId)
      }
    }
  }

  // Assign remaining (unconnected) classes to level 0
  for (const cls of diagram.classes) {
    if (!level.has(cls.id)) level.set(cls.id, 0)
  }

  // --- Position classes by level ---
  // Group classes by level
  const maxLevel = Math.max(...[...level.values()], 0)
  const levelGroups: string[][] = Array.from({ length: maxLevel + 1 }, () => [])
  for (const cls of diagram.classes) {
    levelGroups[level.get(cls.id)!]!.push(cls.id)
  }

  // Compute positions: each level is a row, classes in a row are spaced horizontally
  const placed = new Map<string, PlacedClass>()
  let currentY = 0

  for (let lv = 0; lv <= maxLevel; lv++) {
    const group = levelGroups[lv]!
    if (group.length === 0) continue

    let currentX = 0
    let maxH = 0

    for (const id of group) {
      const cls = classById.get(id)!
      const w = classBoxW.get(id)!
      const h = classBoxH.get(id)!
      placed.set(id, {
        cls,
        sections: classSections.get(id)!,
        x: currentX,
        y: currentY,
        width: w,
        height: h,
      })
      currentX += w + hGap
      maxH = Math.max(maxH, h)
    }

    currentY += maxH + vGap
  }

  // --- Create canvas ---
  let totalW = 0
  let totalH = 0
  for (const p of placed.values()) {
    totalW = Math.max(totalW, p.x + p.width)
    totalH = Math.max(totalH, p.y + p.height)
  }

  // Extra space for relationship lines that may go below/beside
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

  // --- Draw class boxes ---
  for (const p of placed.values()) {
    const boxCanvas = drawMultiBox(
      p.sections,
      useAscii,
      config.boxBorderPadding,
    )
    // Copy box onto main canvas at (p.x, p.y) with role tracking
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

  // --- Build occupancy map for collision avoidance ---
  // Track which x positions are occupied at each y level (to avoid routing through boxes)
  const boxOccupancy: { x1: number; x2: number; y1: number; y2: number }[] = []
  for (const p of placed.values()) {
    boxOccupancy.push({
      x1: p.x,
      x2: p.x + p.width - 1,
      y1: p.y,
      y2: p.y + p.height - 1,
    })
  }

  /** Check if a point (x, y) is inside any class box */
  function isInsideBox(
    x: number,
    y: number,
    excludeIds?: Set<string>,
  ): boolean {
    for (const [id, p] of placed.entries()) {
      if (excludeIds?.has(id)) continue
      if (
        x >= p.x &&
        x <= p.x + p.width - 1 &&
        y >= p.y &&
        y <= p.y + p.height - 1
      ) {
        return true
      }
    }
    return false
  }

  /** Find a clear vertical column for routing that doesn't pass through any boxes */
  function findClearColumn(
    startX: number,
    y1: number,
    y2: number,
    excludeIds: Set<string>,
  ): number {
    // Try the original column first
    let clear = true
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
      if (isInsideBox(startX, y, excludeIds)) {
        clear = false
        break
      }
    }
    if (clear) return startX

    // Try columns to the left and right, alternating
    for (let offset = 1; offset < totalW + 10; offset++) {
      // Try right
      const rightX = startX + offset
      clear = true
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        if (isInsideBox(rightX, y, excludeIds)) {
          clear = false
          break
        }
      }
      if (clear) return rightX

      // Try left
      const leftX = startX - offset
      if (leftX >= 0) {
        clear = true
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
          if (isInsideBox(leftX, y, excludeIds)) {
            clear = false
            break
          }
        }
        if (clear) return leftX
      }
    }

    // Fallback to right edge of canvas + some extra space
    return totalW + 2
  }

  // --- Draw relationship lines ---
  const H = useAscii ? '-' : '─'
  const V = useAscii ? '|' : '│'
  const dashH = useAscii ? '.' : '╌'
  const dashV = useAscii ? ':' : '┊'

  // When more than one relationship connects the same pair of classes —
  // most commonly a pair going in opposite directions, e.g. both
  // `View --> Model` and `Model ..> View` — every relationship's connection
  // point defaults to the exact same box-center column. Left alone, that
  // means their lines, arrowheads, and labels all land on the same cells:
  // whichever relationship draws last silently overwrites the other's, so
  // it appears to vanish from the ASCII output entirely (issue #448). Give
  // each relationship in such a group its own column, spread symmetrically
  // around the box center, so their routes never start from the same point.
  // Spacing is sized to the widest label in the group (not a fixed
  // constant) so long labels still clear each other horizontally.
  const relColumnOffset = new Map<number, number>()
  {
    const pairGroups = new Map<string, number[]>()
    diagram.relationships.forEach((rel, i) => {
      const pairKey = [rel.from, rel.to].sort().join('::')
      const group = pairGroups.get(pairKey) ?? []
      group.push(i)
      pairGroups.set(pairKey, group)
    })
    for (const group of pairGroups.values()) {
      if (group.length < 2) continue
      const n = group.length
      const widestLabel = Math.max(
        ...group.map((i) => {
          const label = diagram.relationships[i]!.label
          if (!label) return 3 // room for just a line/arrow
          return Math.max(...splitLines(label).map((l) => displayWidth(l))) + 2
        }),
      )
      const step = widestLabel + 1 // +1 for a visual gap between labels
      group.forEach((relIndex, pos) => {
        relColumnOffset.set(relIndex, Math.round((pos - (n - 1) / 2) * step))
      })
    }
  }

  /** Keep an offset connection point within the box's own width. */
  function clampToBoxWidth(offset: number, boxWidth: number): number {
    const maxOffset = Math.max(0, Math.floor((boxWidth - 2) / 2))
    return Math.max(-maxOffset, Math.min(maxOffset, offset))
  }

  diagram.relationships.forEach((rel, relIndex) => {
    const fromP = placed.get(rel.from)
    const toP = placed.get(rel.to)
    if (!fromP || !toP) return

    const marker = getRelMarker(rel.type, rel.markerAt)
    const lineH = marker.dashed ? dashH : H
    const lineV = marker.dashed ? dashV : V

    // Exclude source and target boxes from collision detection
    const excludeIds = new Set([rel.from, rel.to])

    const rawOffset = relColumnOffset.get(relIndex) ?? 0

    // Connection points: center-bottom of source → center-top of target
    const fromCX =
      fromP.x +
      Math.floor(fromP.width / 2) +
      clampToBoxWidth(rawOffset, fromP.width)
    const fromBY = fromP.y + fromP.height - 1
    const toCX =
      toP.x + Math.floor(toP.width / 2) + clampToBoxWidth(rawOffset, toP.width)
    const toTY = toP.y

    // Route: Manhattan routing with collision avoidance
    // If target is below source: vertical down from source, horizontal if needed, vertical down to target
    // If same row: horizontal line with a small vertical detour above or below
    if (fromBY < toTY) {
      // Target is below source — routing with collision avoidance
      // Find a clear vertical column for the ENTIRE path from source to target
      const routeX = findClearColumn(fromCX, fromBY + 1, toTY - 1, excludeIds)
      const needsDetour = routeX !== fromCX

      // Expand canvas if needed to accommodate routing column
      if (routeX >= totalW) {
        increaseSize(canvas, routeX + 2, totalH)
      }

      if (needsDetour) {
        // COLLISION CASE: Route around intermediate boxes
        // Path: source center → horizontal to routeX → vertical to entry → horizontal to target center

        const exitY = fromBY + 1
        const entryY = toTY - 1

        // 1. Horizontal from source center to route column
        const lx1 = Math.min(fromCX, routeX)
        const rx1 = Math.max(fromCX, routeX)
        for (let x = lx1; x <= rx1; x++) {
          setC(x, exitY, lineH, 'line')
        }
        if (!useAscii && exitY < (canvas[0]?.length ?? 0)) {
          if (fromCX < routeX) {
            setC(fromCX, exitY, '└', 'corner')
            setC(routeX, exitY, '┐', 'corner')
          } else {
            setC(fromCX, exitY, '┘', 'corner')
            setC(routeX, exitY, '┌', 'corner')
          }
        }

        // 2. Vertical at routeX from exit to entry
        for (let y = exitY + 1; y <= entryY; y++) {
          setC(routeX, y, lineV, 'line')
        }

        // 3. Horizontal from routeX to target center at entry
        if (routeX !== toCX) {
          const lx2 = Math.min(routeX, toCX)
          const rx2 = Math.max(routeX, toCX)
          for (let x = lx2; x <= rx2; x++) {
            setC(x, entryY, lineH, 'line')
          }
          if (!useAscii && entryY < (canvas[0]?.length ?? 0)) {
            if (routeX < toCX) {
              setC(routeX, entryY, '└', 'corner')
              setC(toCX, entryY, '┐', 'corner')
            } else {
              setC(routeX, entryY, '┘', 'corner')
              setC(toCX, entryY, '┌', 'corner')
            }
          }
        }

        // Markers for detour case
        if (marker.markerAt === 'to') {
          // Target sits below this point — the arrowhead must point down
          // into it. Hierarchical markers (inheritance/realization) rotate
          // opposite to directional ones (association/dependency): passing
          // 'up' yields a hierarchical marker's down-pointing glyph, while
          // 'down' yields a directional marker's down-pointing glyph. See
          // the matching compensation in the "target is above source"
          // branch below, which handles the mirrored case.
          const isHierarchical =
            marker.type === 'inheritance' || marker.type === 'realization'
          const markerChar = getMarkerShape(
            marker.type,
            useAscii,
            isHierarchical ? 'up' : 'down',
          )
          setC(toCX, entryY, markerChar, 'arrow')
        }
        if (marker.markerAt === 'from') {
          const markerChar = getMarkerShape(marker.type, useAscii, 'down')
          setC(fromCX, fromBY + 1, markerChar, 'arrow')
        }
      } else {
        // NO COLLISION CASE: Use original midpoint-based routing
        // Path: source center → vertical to midY → horizontal at midY → vertical to target

        const midY = fromBY + Math.floor((toTY - fromBY) / 2)

        // 1. Vertical from source bottom to midY
        for (let y = fromBY + 1; y <= midY; y++) {
          setC(fromCX, y, lineV, 'line')
        }

        // 2. Horizontal from fromCX to toCX at midY (if needed)
        if (fromCX !== toCX && midY < (canvas[0]?.length ?? 0)) {
          const lx = Math.min(fromCX, toCX)
          const rx = Math.max(fromCX, toCX)
          for (let x = lx; x <= rx; x++) {
            setC(x, midY, lineH, 'line')
          }
          if (!useAscii) {
            setC(fromCX, midY, fromCX < toCX ? '└' : '┘', 'corner')
            setC(toCX, midY, fromCX < toCX ? '┐' : '┌', 'corner')
          }
        }

        // 3. Vertical from midY to target top
        for (let y = midY + 1; y < toTY; y++) {
          setC(toCX, y, lineV, 'line')
        }

        // Markers for no-collision case
        if (marker.markerAt === 'to') {
          // Same rotation compensation as the detour case above — target is
          // below this point, so hierarchical markers need 'up' to point
          // down into it.
          const isHierarchical =
            marker.type === 'inheritance' || marker.type === 'realization'
          setC(
            toCX,
            toTY - 1,
            getMarkerShape(
              marker.type,
              useAscii,
              isHierarchical ? 'up' : 'down',
            ),
            'arrow',
          )
        }
        if (marker.markerAt === 'from') {
          setC(
            fromCX,
            fromBY + 1,
            getMarkerShape(marker.type, useAscii, 'down'),
            'arrow',
          )
        }
      }
    } else if (toP.y + toP.height - 1 < fromP.y) {
      // Target is ABOVE source — draw upward from source top to target bottom
      const fromTY = fromP.y
      const toBY = toP.y + toP.height - 1
      const midY = toBY + Math.floor((fromTY - toBY) / 2)

      for (let y = fromTY - 1; y >= midY; y--) {
        setC(fromCX, y, lineV, 'line')
      }

      if (fromCX !== toCX) {
        const lx = Math.min(fromCX, toCX)
        const rx = Math.max(fromCX, toCX)
        for (let x = lx; x <= rx; x++) {
          setC(x, midY, lineH, 'line')
        }
        if (!useAscii && midY >= 0 && midY < totalH) {
          setC(fromCX, midY, fromCX < toCX ? '┌' : '┐', 'corner')
          setC(toCX, midY, fromCX < toCX ? '┘' : '└', 'corner')
        }
      }

      for (let y = midY - 1; y > toBY; y--) {
        setC(toCX, y, lineV, 'line')
      }

      // Draw markers - arrows point in the direction of the vertical segment (upward)
      if (marker.markerAt === 'from') {
        const markerChar = getMarkerShape(marker.type, useAscii, 'up')
        const my = fromTY - 1
        for (let i = 0; i < markerChar.length; i++) {
          setC(
            fromCX - Math.floor(markerChar.length / 2) + i,
            my,
            markerChar[i]!,
            'arrow',
          )
        }
      }
      if (marker.markerAt === 'to') {
        const isHierarchical =
          marker.type === 'inheritance' || marker.type === 'realization'
        const markerDir = isHierarchical ? 'down' : 'up'
        const markerChar = getMarkerShape(marker.type, useAscii, markerDir)
        const my = toBY + 1
        for (let i = 0; i < markerChar.length; i++) {
          setC(
            toCX - Math.floor(markerChar.length / 2) + i,
            my,
            markerChar[i]!,
            'arrow',
          )
        }
      }
    } else {
      // Same level — draw horizontal line with a detour below both boxes
      const detourY = Math.max(fromBY, toP.y + toP.height - 1) + 2
      increaseSize(canvas, totalW, detourY + 1)
      increaseRoleCanvasSize(rc, totalW, detourY + 1)

      // Vertical down from source
      for (let y = fromBY + 1; y <= detourY; y++) {
        setC(fromCX, y, lineV, 'line')
      }
      // Horizontal
      const lx = Math.min(fromCX, toCX)
      const rx = Math.max(fromCX, toCX)
      for (let x = lx; x <= rx; x++) {
        setC(x, detourY, lineH, 'line')
      }
      // Vertical up to target
      for (let y = detourY - 1; y >= toP.y + toP.height; y--) {
        setC(toCX, y, lineV, 'line')
      }

      // Draw markers - same-level routing uses vertical segments at both ends
      if (marker.markerAt === 'from') {
        const markerChar = getMarkerShape(marker.type, useAscii, 'down')
        const my = fromBY + 1
        for (let i = 0; i < markerChar.length; i++) {
          setC(
            fromCX - Math.floor(markerChar.length / 2) + i,
            my,
            markerChar[i]!,
            'arrow',
          )
        }
      }
      if (marker.markerAt === 'to') {
        // Target sits above this point (line detours below both boxes then
        // comes back up) — mirrors the "target is above source" branch's
        // compensation above.
        const isHierarchical =
          marker.type === 'inheritance' || marker.type === 'realization'
        const markerChar = getMarkerShape(
          marker.type,
          useAscii,
          isHierarchical ? 'down' : 'up',
        )
        const my = toP.y + toP.height
        for (let i = 0; i < markerChar.length; i++) {
          setC(
            toCX - Math.floor(markerChar.length / 2) + i,
            my,
            markerChar[i]!,
            'arrow',
          )
        }
      }
    }
  })

  // --- Precompute each label's horizontal territory ---
  // A label's left/right bound is derived purely from connection-point
  // geometry — never from draw order or from what another relationship's
  // label happened to render as. Two labels whose natural (fully centered,
  // unclamped) spans would actually overlap split the contested space
  // evenly at the midpoint between their connection columns; labels that
  // don't naturally overlap are left unconstrained by each other.
  //
  // This matters because a *reactive* approach — only checking cells an
  // earlier iteration already drew text into — cascades: a label pinned
  // near the canvas's left edge (idealLabelStart < 0) used to be *shifted*
  // fully into view via `Math.max(0, idealLabelStart)` rather than
  // *clipped*, which silently ate into its neighbor's rightful column; that
  // neighbor then had nothing left to reactively claim and vanished
  // entirely, while labels further along drifted based on whatever was
  // left over. Precomputing fixed, mutually exclusive territories up front
  // — before any label is drawn — means every label's placement is
  // consistent regardless of relationship order, and a genuinely
  // insufficient column width (e.g. six same-row relationships spaced
  // closer together than their labels are wide) truncates *all* of them
  // consistently instead of destroying an arbitrary subset. See issue #447.
  interface LabelGeometry {
    rel: (typeof diagram.relationships)[number]
    idealMidX: number
    naturalStart: number
    naturalEnd: number
    rowStart: number
    rowEnd: number
  }
  const labelGeometry: LabelGeometry[] = []
  for (const rel of diagram.relationships) {
    if (!rel.label) continue
    const fromP = placed.get(rel.from)
    const toP = placed.get(rel.to)
    if (!fromP || !toP) continue
    const fromCX = fromP.x + Math.floor(fromP.width / 2)
    const fromBY = fromP.y + fromP.height - 1
    const toCX = toP.x + Math.floor(toP.width / 2)
    const toTY = toP.y
    const idealMidX = Math.floor((fromCX + toCX) / 2)

    // Same baseMidY branch the draw pass below uses — needed so territory
    // splitting only ever kicks in between labels that could actually land
    // on overlapping rows. Two relationships can share a similar idealMidX
    // while being drawn many rows apart (e.g. one class's two separate
    // outgoing edges to two different targets at different heights) —
    // splitting their X territory in that case truncates both for no
    // reason, since they never actually collide.
    const lines = splitLines(rel.label)
    const halfHeight = Math.floor(lines.length / 2)
    let baseMidY: number
    if (fromBY < toTY) {
      baseMidY = Math.floor((fromBY + 1 + toTY - 1) / 2)
    } else if (toP.y + toP.height - 1 < fromP.y) {
      const toBY = toP.y + toP.height - 1
      baseMidY = Math.floor((toBY + 1 + fromP.y - 1) / 2)
    } else {
      baseMidY = Math.max(fromBY, toP.y + toP.height - 1) + 2
    }

    const width = Math.max(...lines.map(displayWidth)) + 2 // +2 for padding
    // Clamped the same way the draw loop below clamps it (never negative —
    // a label can't render left of the canvas edge) so this overlap check
    // reflects what will actually be drawn. Using the *unclamped* value
    // here would miss overlaps a left-edge label creates once it's shifted
    // into view: it would compute this label's territory as if it stayed
    // off-canvas at its raw, negative position instead of at column 0,
    // under-detecting a real collision with its neighbor (issue #447).
    const naturalStart = Math.max(0, idealMidX - Math.floor(width / 2))
    labelGeometry.push({
      rel,
      idealMidX,
      naturalStart,
      naturalEnd: naturalStart + width - 1,
      rowStart: baseMidY - halfHeight,
      rowEnd: baseMidY + halfHeight,
    })
  }
  labelGeometry.sort((a, b) => a.idealMidX - b.idealMidX)

  /** Whether two labels' row spans actually intersect — see LabelGeometry's rowStart/rowEnd comment. */
  function rowsOverlap(a: LabelGeometry, b: LabelGeometry): boolean {
    return a.rowStart <= b.rowEnd && b.rowStart <= a.rowEnd
  }

  const territoryByRel = new Map<
    (typeof diagram.relationships)[number],
    { left: number; right: number }
  >()
  for (let i = 0; i < labelGeometry.length; i++) {
    const g = labelGeometry[i]!
    const prev = labelGeometry[i - 1]
    const next = labelGeometry[i + 1]
    const left =
      prev && prev.naturalEnd >= g.naturalStart && rowsOverlap(prev, g)
        ? Math.floor((prev.idealMidX + g.idealMidX) / 2) + 1
        : -Infinity
    const right =
      next && g.naturalEnd >= next.naturalStart && rowsOverlap(g, next)
        ? Math.floor((g.idealMidX + next.idealMidX) / 2)
        : Infinity
    territoryByRel.set(g.rel, { left, right })
  }

  // --- Draw relationship labels ---
  // Deliberately a separate pass over *all* relationships, run only after
  // every relationship's lines are drawn above. Labels used to be drawn
  // inline with each relationship's own lines, which let a *later*
  // relationship's connector line silently overwrite an *earlier*
  // relationship's already-drawn label whenever both routes crossed the
  // same row — e.g. two edges converging on one target box both jog through
  // the same midpoint row (issue #447, "teaches" truncated to "tea" and
  // merged into a box-drawing corner). Running all lines first means no
  // line write can ever land on top of label text again.
  for (const rel of diagram.relationships) {
    const fromP = placed.get(rel.from)
    const toP = placed.get(rel.to)
    if (!fromP || !toP) continue
    if (!rel.label) continue

    // Exclude source and target boxes from collision detection
    const excludeIds = new Set([rel.from, rel.to])

    // Connection points: center-bottom of source → center-top of target
    const fromCX = fromP.x + Math.floor(fromP.width / 2)
    const fromBY = fromP.y + fromP.height - 1
    const toCX = toP.x + Math.floor(toP.width / 2)
    const toTY = toP.y

    // Draw relationship label at midpoint (supports multi-line)
    // Add padding around the label for readability
    {
      const lines = splitLines(rel.label)
      const maxLabelWidth = Math.max(...lines.map((l) => displayWidth(l))) + 2 // +2 for padding

      // Calculate ideal label position based on routing direction
      let baseMidY: number
      let idealMidX: number

      if (fromBY < toTY) {
        // Target below source: place in gap between source bottom and target top
        baseMidY = Math.floor((fromBY + 1 + toTY - 1) / 2)
        idealMidX = Math.floor((fromCX + toCX) / 2)
      } else if (toP.y + toP.height - 1 < fromP.y) {
        // Target above source: place in gap between target bottom and source top
        const toBY = toP.y + toP.height - 1
        baseMidY = Math.floor((toBY + 1 + fromP.y - 1) / 2)
        idealMidX = Math.floor((fromCX + toCX) / 2)
      } else {
        // Same level: place label at midpoint of the detour line
        baseMidY = Math.max(fromBY, toP.y + toP.height - 1) + 2
        idealMidX = Math.floor((fromCX + toCX) / 2)
      }

      // Find a clear vertical position for the label (not inside any box)
      let labelY = baseMidY
      const halfHeight = Math.floor(lines.length / 2)

      // Check if any label line would be inside a box
      let labelInBox = false
      for (let i = 0; i < lines.length; i++) {
        const y = labelY - halfHeight + i
        const idealLabelStart = idealMidX - Math.floor(maxLabelWidth / 2)
        const labelStart = Math.max(0, idealLabelStart)
        // Check if this line overlaps any box
        for (let x = labelStart; x < labelStart + maxLabelWidth; x++) {
          if (isInsideBox(x, y, excludeIds)) {
            labelInBox = true
            break
          }
        }
        if (labelInBox) break
      }

      // If label is inside a box, find the gap between boxes
      if (labelInBox) {
        // Find the gap between source and target boxes
        const gapTop = fromBY + 1
        const gapBottom = toTY - 1

        // Place label in the middle of the gap, outside any intermediate box
        for (let y = gapTop; y <= gapBottom; y++) {
          let clearRow = true
          const idealLabelStart = idealMidX - Math.floor(maxLabelWidth / 2)
          const labelStart = Math.max(0, idealLabelStart)
          for (let x = labelStart; x < labelStart + maxLabelWidth; x++) {
            if (isInsideBox(x, y, excludeIds)) {
              clearRow = false
              break
            }
          }
          if (clearRow) {
            labelY = y
            break
          }
        }
      }

      // Center lines vertically around labelY
      const startY = labelY - halfHeight

      const territory = territoryByRel.get(rel)!

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const y = startY + lineIdx
        const text = lines[lineIdx]!

        // Grid cells, not code units: a wide glyph occupies two columns, so
        // measuring/writing by code unit would centre the label wrong and
        // overrun the space cleared for it.
        const naturalCells = toDisplayCells(` ${text} `) // space padding on both sides
        // Clamped to never go negative — matches the clamp the territory
        // precomputation above already applied when deciding whether this
        // label and its neighbors' natural spans overlap, so the two stay
        // consistent. `fitLabelToAvailableWidth` still clips in place
        // rather than shifting for whatever collisions the territory
        // bounds encode, including one this very clamp creates against a
        // left neighbor (see the territory precomputation's comment).
        const naturalStart = Math.max(
          0,
          idealMidX - Math.floor(naturalCells.length / 2),
        )

        const { start: labelStart, cells } = fitLabelToAvailableWidth(
          naturalStart,
          naturalCells,
          text,
          Math.max(0, territory.left),
          territory.right,
        )

        // Ensure canvas is wide enough for the label
        const labelEnd = labelStart + cells.length
        if (labelEnd > 0 && y >= 0) {
          increaseSize(canvas, Math.max(labelEnd, 1), Math.max(y + 1, 1))
          increaseRoleCanvasSize(rc, Math.max(labelEnd, 1), Math.max(y + 1, 1))
        }
        // Clear the area first (overwrite line characters) then draw the padded label
        for (let i = 0; i < cells.length; i++) {
          const lx = labelStart + i
          if (lx >= 0 && y >= 0) {
            setC(lx, y, cells[i]!, 'text')
          }
        }
      }
    }
  }

  return canvasToString(canvas, { roleCanvas: rc, colorMode, theme })
}
