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

import { parseClassDiagram } from '@zombie-mermaid/mermaid-parser'
import type {
  ClassDiagram,
  ClassNode,
  ClassNote,
  ClassRelationship,
  RelationshipType,
} from '@zombie-mermaid/mermaid-parser'
import type {
  AsciiConfig,
  LabelRect,
  Canvas,
  CharRole,
  RoleCanvas,
  AsciiTheme,
  ColorMode,
} from './types.ts'
import {
  mkCanvas,
  mkRoleCanvas,
  canvasToString,
  increaseSize,
  increaseRoleCanvasSize,
  write,
  isJunctionChar,
  mergeJunctions,
  flipCanvasVertically,
  flipRoleCanvasVertically,
  mirrorLabelRows,
} from './canvas.ts'
import { drawMultiBox, measureMultiBox, classifyBoxChar } from './draw.ts'
import { allocateTerritory } from './territory.ts'
import type { Territory } from './territory.ts'
import {
  flipLinkCanvasVertically,
  markBoxLabelLinks,
  mkLinkCanvas,
} from './hyperlinks.ts'
import type { LinkCanvas } from './hyperlinks.ts'
import { safeHref, splitStatements } from '@zombie-mermaid/core'
import { getCorners } from './shapes/corners.ts'
import { splitLines } from './multiline-utils.ts'
import { buildClassSections } from './class-sections.ts'
import { displayWidth, toDisplayCells } from './display-width.ts'
import { findFreeLane } from './lane-search.ts'
import { isSideways, renderClassFlowAscii } from './class-flow.ts'
import { DEFAULT_PADDING_X, DEFAULT_PADDING_Y, paddingOffset } from './types.ts'

// ============================================================================
// Relationship marker characters
// ============================================================================

interface RelMarker {
  /** Relationship type (determines marker shape) */
  type: RelationshipType
  /** Which end the marker is placed at */
  markerAt: 'from' | 'to' | 'both'
  /** Whether the line is dashed */
  dashed: boolean
}

/**
 * Build the marker metadata for a relationship.
 * The actual marker character will be determined at placement time based on line direction.
 */
function getRelMarker(
  type: RelationshipType,
  markerAt: 'from' | 'to' | 'both',
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
    case 'lollipop':
      // Hollow circle (interface) - omnidirectional shape
      return useAscii ? 'O' : '○'
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
 * Marker for the `from` end, drawn with the line's travel direction at that
 * end. Hierarchical triangles already point back into the box for that
 * direction; directional arrows must point the opposite way (into the box),
 * so flip them. Omnidirectional markers ignore the direction.
 */
function getFromMarkerShape(
  type: RelationshipType,
  useAscii: boolean,
  direction: 'up' | 'down' | 'left' | 'right',
): string {
  const hierarchical = type === 'inheritance' || type === 'realization'
  const flip = { up: 'down', down: 'up', left: 'right', right: 'left' } as const
  return getMarkerShape(
    type,
    useAscii,
    hierarchical ? direction : flip[direction],
  )
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
        ? textCells.slice(textCells.length - innerWidth) // Keep the tail
        : textCells.slice(0, innerWidth) // Keep the head

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

/**
 * Display width of a relationship label as it is actually drawn: its widest
 * line plus one padding space on each side. Every pass that needs to know
 * how much horizontal room a label takes (column reservation, per-pair
 * column spacing, territory precomputation, drawing) must measure it the
 * same way, or the room reserved up front won't match what gets drawn.
 */
function labelCellWidth(label: string): number {
  return Math.max(...splitLines(label).map((l) => displayWidth(l))) + 2
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

// Namespace frames: a frame's border sits `FRAME_SIDE_PAD` columns outside
// its member boxes (one blank column of padding, then the border), the top
// border (which carries the title) two rows above, and the bottom border two
// rows below. The gaps between boxes and levels grow by the matching amount
// so a frame never needs more room than the gap it sits in.
const FRAME_SIDE_PAD = 2
const FRAME_TOP_PAD = 2
const FRAME_BOTTOM_PAD = 2
const FRAME_EXTRA_HGAP = FRAME_SIDE_PAD * 2
const FRAME_EXTRA_VGAP = FRAME_TOP_PAD + FRAME_BOTTOM_PAD - 1
// Rows added below a level holding a single-line relationship label.
const LABEL_EXTRA_VGAP = 2
// Rows added below the level above a box whose incoming edge detours around
// an intermediate box: the detour's entry run needs its own row above the
// arrowhead row so the head has a stem (issue #2056), clear of the labels.
const DETOUR_EXTRA_VGAP = 2
// Blank columns between a cardinality and the line it labels (the marker
// takes the cell on the line itself).
const CARDINALITY_GAP = 1

// Rows needed between two levels joined by a relationship that carries a
// cardinality (issue #2114): one row hugging each box, so each cardinality
// sits beside the line next to its own end, around the `labelLines` rows the
// label takes (a multi-line label is centred on the middle row, so an even
// count needs one more row to stay clear of both).
function cardinalityGapRows(labelLines: number): number {
  return Math.max(labelLines, 1) + 2 + (labelLines % 2 === 0 ? 1 : 0)
}

/** A `namespace` block with at least one member class in the diagram. */
export interface AsciiNamespaceFrame {
  name: string
  /** Member class ids, including the notes attached to those classes. */
  ids: string[]
}

/**
 * Namespaces to frame. A class claimed by two namespaces stays in the first;
 * unknown members and empty namespaces are dropped; a note attached to a
 * member class joins that class's frame, since it sits right beside it.
 */
function resolveFrames(
  diagram: ClassDiagram,
  notesById: Map<string, ClassNote>,
  lollipops: Map<string, AsciiLollipop>,
): AsciiNamespaceFrame[] {
  const known = new Set(diagram.classes.map((c) => c.id))
  const claimed = new Set<string>()
  const frames: AsciiNamespaceFrame[] = []
  for (const ns of diagram.namespaces) {
    const ids: string[] = []
    for (const id of ns.classIds) {
      if (!known.has(id) || claimed.has(id)) continue
      claimed.add(id)
      ids.push(id)
      for (const [noteId, note] of notesById) {
        if (note.forClass === id) ids.push(noteId)
      }
      for (const [lolliId, lolli] of lollipops) {
        if (lolli.host === id) ids.push(lolliId)
      }
    }
    if (ids.length > 0) frames.push({ name: ns.name, ids })
  }
  return frames
}

/**
 * Reorder one level's classes so each frame's members sit next to each
 * other, at the position of the frame's first member. Order inside a frame,
 * and among unframed classes, is unchanged.
 */
function groupByFrame(group: string[], frameOf: Map<string, number>): string[] {
  const out: string[] = []
  const emitted = new Set<number>()
  for (const id of group) {
    const f = frameOf.get(id)
    if (f === undefined) {
      out.push(id)
    } else if (!emitted.has(f)) {
      emitted.add(f)
      out.push(...group.filter((other) => frameOf.get(other) === f))
    }
  }
  return out
}

/** Per-render switches that aren't layout config (see `AsciiRenderOptions`). */
export interface ClassAsciiOptions {
  /** Wrap each `click`-linked class's name in an OSC 8 hyperlink pair. */
  hyperlinks?: boolean
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
  options: ClassAsciiOptions = {},
  // Levels whose gap below needs DETOUR_EXTRA_VGAP rows; set by the second
  // layout pass (see `detourEntryLevels`).
  detourRoomLevels?: ReadonlySet<number>,
  // Columns the whole diagram shifts right, set by the second layout pass
  // when a cardinality had no room left of the line (see the cardinality pass).
  cardinalityLeftPad = 0,
): string {
  const lines = splitStatements(text)
  // Notes ride through the layout as pseudo-classes — see withNotePseudoClasses.
  const { diagram: lollipopDiagram, lollipops } = withLollipopPseudoClasses(
    parseClassDiagram(lines),
  )
  const { diagram, notesById } = withNotePseudoClasses(lollipopDiagram)
  // Only BT is honoured here: it is the top-down layout flipped at the end
  // (boxes kept upright). LR and RL need a column layout this level-row
  // renderer does not have, so they stay top-down. See docs/diagrams.md.
  const bottomUp = diagram.direction === 'BT'

  if (diagram.classes.length === 0) return ''
  const frames = resolveFrames(diagram, notesById, lollipops)
  // LR and RL are laid out on the flowchart grid, not by the level rows below.
  if (isSideways(diagram.direction)) {
    return renderClassFlowAscii(
      { diagram, lollipops, notesById, frames },
      config,
      colorMode,
      theme,
      options,
    )
  }
  const frameOf = new Map<string, number>()
  for (const [i, fr] of frames.entries()) {
    for (const id of fr.ids) frameOf.set(id, i)
  }

  const useAscii = config.useAscii
  // See paddingOffset's doc comment (types.ts) for why these are an offset
  // from the padding defaults rather than the raw config values.
  const hGap =
    paddingOffset(config.paddingX, DEFAULT_PADDING_X, 4, 1) +
    (frames.length > 0 ? FRAME_EXTRA_HGAP : 0) // Horizontal gap between class boxes
  const vGap =
    paddingOffset(config.paddingY, DEFAULT_PADDING_Y, 3, 1) +
    (frames.length > 0 ? FRAME_EXTRA_VGAP : 0) // Vertical gap between levels (enough for relationship lines)

  // --- Build box dimensions for each class ---
  const classSections = new Map<string, string[][]>()
  const classBoxW = new Map<string, number>()
  const classBoxH = new Map<string, number>()

  for (const cls of diagram.classes) {
    const sections = buildClassSections(cls)
    classSections.set(cls.id, sections)

    // An interface name has no box: one text row, with the circle drawn by
    // the lollipop edge just above or below it.
    if (lollipops.has(cls.id)) {
      classBoxW.set(cls.id, displayWidth(cls.label))
      classBoxH.set(cls.id, 1)
      continue
    }

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

  const parents = new Map<string, Set<string>>() // Child → set of parent IDs
  const children = new Map<string, Set<string>>() // Parent → set of child IDs

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
      if (newLevel > levelCap) continue // Cycle detected — skip to prevent infinite loop
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

  // A frame is the bounding box of its members, so a class that sits between
  // two namespaces' rows interleaves them and the boxes overlap. When all
  // edges between two frames run one way, put the target frame wholly below
  // the source frame, as mermaid does, then restore parent-above-child for
  // everything pushed down. Frames in a cycle keep their levels.
  if (frames.length > 1) {
    const before = new Map(level)
    const frameEdges = new Set<string>()
    for (const rel of diagram.relationships) {
      const a = frameOf.get(rel.from)
      const b = frameOf.get(rel.to)
      if (a !== undefined && b !== undefined && a !== b) {
        frameEdges.add(`${a}>${b}`)
      }
    }
    let stable = false
    for (let pass = 0; pass <= frames.length && !stable; pass++) {
      stable = true
      for (const key of frameEdges) {
        const [a, b] = key.split('>').map(Number) as [number, number]
        if (frameEdges.has(`${b}>${a}`)) continue
        const maxA = Math.max(...frames[a]!.ids.map((id) => level.get(id)!))
        const minB = Math.min(...frames[b]!.ids.map((id) => level.get(id)!))
        const delta = maxA + 1 - minB
        if (delta <= 0) continue
        for (const id of frames[b]!.ids) level.set(id, level.get(id)! + delta)
        stable = false
      }
      for (let i = 0; i < diagram.classes.length; i++) {
        for (const rel of diagram.relationships) {
          const need = level.get(rel.from)! + 1
          if (rel.from !== rel.to && level.get(rel.to)! < need) {
            level.set(rel.to, need)
            stable = false
          }
        }
      }
    }
    if (!stable) for (const [id, lv] of before) level.set(id, lv)
  }

  // A `note for X` note has no relationships, so it landed on level 0 above;
  // move it onto its class's row so the row placement below puts it right
  // beside that class.
  // Namespace frames keep the note beside its class: a note moved a level up
  // could land inside another frame, with its link crossing the border.
  pinNoteLevels(notesById, level, bottomUp && frames.length === 0)

  // --- Position classes by level ---
  // Group classes by level
  const maxLevel = Math.max(...[...level.values()], 0)
  const levelGroups: string[][] = Array.from({ length: maxLevel + 1 }, () => [])
  for (const cls of diagram.classes) {
    levelGroups[level.get(cls.id)!]!.push(cls.id)
  }
  if (frames.length > 0) {
    for (const [i, g] of levelGroups.entries()) {
      levelGroups[i] = groupByFrame(g, frameOf)
    }
  }

  // Levels whose gap below holds a single-line relationship label: the gap
  // grows by LABEL_EXTRA_VGAP rows so the label sits on its path with a stem
  // above it, like mermaid's edge labels, instead of replacing the only stem.
  // A lone parent-child pair is centred (a straight stem), so only a source
  // with several children or a target with several parents is expected to
  // need a horizontal run.
  const labelRoomLevels = new Set<number>()
  const outDeg = new Map<string, number>()
  const inDeg = new Map<string, number>()
  for (const rel of diagram.relationships) {
    outDeg.set(rel.from, (outDeg.get(rel.from) ?? 0) + 1)
    inDeg.set(rel.to, (inDeg.get(rel.to) ?? 0) + 1)
  }
  for (const rel of diagram.relationships) {
    const from = level.get(rel.from)
    const to = level.get(rel.to)
    if (
      rel.label &&
      splitLines(rel.label).length === 1 &&
      from !== undefined &&
      to !== undefined &&
      from < to &&
      // A marker at both ends leaves no stem between the two heads and the
      // label, so a labelled two-ended line always needs the extra room.
      (rel.markerAt === 'both' ||
        outDeg.get(rel.from)! > 1 ||
        inDeg.get(rel.to)! > 1)
    ) {
      labelRoomLevels.add(from)
    }
  }

  // Levels whose gap holds a relationship's cardinality (either end): that
  // gap is never narrower than `cardinalityGapRows` (issue #2114).
  const cardinalityGapByLevel = new Map<number, number>()
  for (const rel of diagram.relationships) {
    const from = level.get(rel.from)
    const to = level.get(rel.to)
    if (
      (rel.fromCardinality || rel.toCardinality) &&
      from !== undefined &&
      to !== undefined &&
      from !== to
    ) {
      const lv = Math.min(from, to)
      cardinalityGapByLevel.set(
        lv,
        Math.max(
          cardinalityGapByLevel.get(lv) ?? 0,
          cardinalityGapRows(rel.label ? splitLines(rel.label).length : 0),
        ),
      )
    }
  }

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
  //
  // Computed before positions are assigned (it depends only on the
  // relationship list) because the column reservation below needs to know
  // how far each group fans out from its boxes' centers.
  /**
   * Unlabelled lines fanned across narrow boxes: shrink the lane spacing so
   * every lane stays inside the box's interior (corner cells excluded). Each
   * line, arrowhead included, then lands on a border cell of its own rather
   * than on a corner glyph or at the end of a jog beside the box (#2335).
   * Labelled groups keep their label spacing, and a cap below 2 would pack
   * lanes together, so the original step is kept then.
   */
  function capStepToInterior(
    step: number,
    group: number[],
    boxIds: string[],
  ): number {
    if (group.some((i) => diagram.relationships[i]!.label)) return step
    const widths = boxIds.map((id) => classBoxW.get(id))
    if (widths.some((w) => w === undefined)) return step
    const cap = Math.floor(
      (Math.min(...(widths as number[])) - 3) / (group.length - 1),
    )
    return cap >= 2 && cap < step ? cap : step
  }

  const relColumnOffset = new Map<number, number>()
  /** Distance between a group's outermost lanes, keyed by member — see `anchorOffset`. */
  const relGroupSpread = new Map<number, number>()
  /** Member count of the group a relationship is fanned in, by relationship. */
  const relGroupSize = new Map<number, number>()
  const relFromSize = new Map<number, number>()
  const relToSize = new Map<number, number>()
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
          if (!label) return 3 // Room for just a line/arrow
          return labelCellWidth(label)
        }),
      )
      let step = widestLabel + 1 // +1 for a visual gap between labels
      step = capStepToInterior(step, group, [
        diagram.relationships[group[0]!]!.from,
        diagram.relationships[group[0]!]!.to,
      ])
      group.forEach((relIndex, pos) => {
        relColumnOffset.set(relIndex, Math.round((pos - (n - 1) / 2) * step))
        relGroupSpread.set(relIndex, (n - 1) * step)
        relGroupSize.set(relIndex, n)
      })
    }
  }

  // Fan relationships that converge on the same target (or diverge from the
  // same source) even when they come from/go to otherwise-unrelated
  // classes — e.g. `Teacher --> Course` and `Student --> Course`, two
  // distinct pairs that both terminate at Course. `pairGroups` above only
  // catches multiple relationships between the exact same two classes;
  // nothing previously separated these, so both anchored at Course's exact
  // center column. That collapsed their lines and arrowheads onto the same
  // cells, and — since a relationship's only horizontal jog can land on a
  // single shared row when the two source rows/box heights are equal —
  // let one relationship's label (drawn in a later pass, unaware of the
  // collision) blot out the entire visible portion of the *other*
  // relationship's connector, leaving it looking like it stops short of
  // its target instead of merely overlapping (issue #632).
  //
  // Scoped to the shared end only — the far end keeps its own center
  // column — since, unlike a duplicate pair, the *other* end of each
  // relationship is a different, unrelated class that needs no fanning of
  // its own. A relationship already offset by `pairGroups` above keeps
  // that symmetric (both-ends) offset unchanged; only relationships with
  // no pair-based offset get fanned here.
  //
  // Further scoped to relationships whose target sits exactly one level
  // below their source (`level.get(to) - level.get(from) === 1`) — a
  // direct, adjacent-level convergence/divergence like this one. A
  // relationship that instead skips a level (e.g. `A --> C` when `B` sits
  // between them at `A --> B --> C`) already needs the existing
  // box-collision detour routing below (`findClearColumn`) to route around
  // the intervening class; fanning its anchor here too would fight that
  // routing over the same geometry it depends on, corrupting it. Excluding
  // skip-level relationships from the group entirely — rather than just
  // from getting an offset — also keeps a same-level sibling's own offset
  // arithmetic (position-in-group, spread) based only on the other
  // relationships it could actually collide with.
  const relFromOffset = new Map<number, number>()
  const relFromSpread = new Map<number, number>()
  const relToOffset = new Map<number, number>()
  const relToSpread = new Map<number, number>()
  {
    const fanBySharedEndpoint = (
      endpointOf: (rel: (typeof diagram.relationships)[number]) => string,
      offsetOut: Map<number, number>,
      spreadOut: Map<number, number>,
      sizeOut: Map<number, number>,
    ): void => {
      const groups = new Map<string, number[]>()
      diagram.relationships.forEach((rel, i) => {
        if (relColumnOffset.has(i)) return // Already fanned as a duplicate pair
        if (!classById.has(rel.from) || !classById.has(rel.to)) return
        const fromLevel = level.get(rel.from) ?? 0
        const toLevel = level.get(rel.to) ?? 0
        if (toLevel - fromLevel !== 1) return // skip-level — leave to detour routing
        const key = endpointOf(rel)
        const group = groups.get(key) ?? []
        group.push(i)
        groups.set(key, group)
      })
      for (const group of groups.values()) {
        if (group.length < 2) continue
        // Order lanes by where the far end sits in its row, so lines that
        // leave left arrive left instead of crossing just above the shared
        // box (mermaid keeps them uncrossed too). Ties keep source order.
        const farX = (i: number): number => {
          const rel = diagram.relationships[i]!
          const far = endpointOf(rel) === rel.to ? rel.from : rel.to
          return levelGroups[level.get(far) ?? 0]!.indexOf(far)
        }
        group.sort((a, b) => farX(a) - farX(b) || a - b)
        const n = group.length
        const widestLabel = Math.max(
          ...group.map((i) => {
            const label = diagram.relationships[i]!.label
            if (!label) return 3 // Room for just a line/arrow
            return labelCellWidth(label)
          }),
        )
        let step = widestLabel + 1 // +1 for a visual gap between labels
        step = capStepToInterior(step, group, [
          endpointOf(diagram.relationships[group[0]!]!),
        ])
        group.forEach((relIndex, pos) => {
          offsetOut.set(relIndex, Math.round((pos - (n - 1) / 2) * step))
          spreadOut.set(relIndex, (n - 1) * step)
          sizeOut.set(relIndex, n)
        })
      }
    }
    fanBySharedEndpoint((rel) => rel.to, relToOffset, relToSpread, relToSize)
    fanBySharedEndpoint(
      (rel) => rel.from,
      relFromOffset,
      relFromSpread,
      relFromSize,
    )
  }

  // --- Reserve column room for relationship labels and fanned-out groups ---
  // A class's horizontal slot used to be exactly its box's content width, so
  // a narrow box (a single-letter class with no members) whose relationship
  // carries a long label had nowhere to put that label: neighbouring labels
  // fought over the same cells and the territory pass below truncated them
  // all to `…` even though the diagram could simply have spread the columns
  // further apart (issue #488). The same shortfall broke multi-relationship
  // groups: the per-pair offsets above can fan out well past a narrow box's
  // edges, and clamping them back inside the box collapsed distinct
  // relationships onto one connection point (issue #489).
  //
  // So each class's column *slot* is its box plus whatever its
  // relationships overhang past the box's edges: for every relationship,
  // the label (or bare line) centered on that relationship's lane reaches
  // some distance left and right of the box's center column, and the slot
  // is padded by however much of that reach falls outside the box. The box
  // itself keeps its content width; only the gap around it grows, and only
  // on the side and by the amount a label or group actually needs — a
  // right-side overhang on the last class of a level, say, moves nothing.
  // Every relationship reserves at *both* of its endpoints so a vertical
  // pair (A above B) is padded identically and B stays directly under A.
  const columnReach = new Map<string, { left: number; right: number }>()
  for (const cls of diagram.classes) {
    columnReach.set(cls.id, { left: 0, right: 0 })
  }
  diagram.relationships.forEach((rel, relIndex) => {
    if (!classById.has(rel.from) || !classById.has(rel.to)) return
    // Mirror the draw pass: a label of `cellW` cells centered on its lane
    // starts `floor(cellW / 2)` cells left of the lane; a bare line/arrow
    // is a single cell on the lane itself. Each endpoint reserves room
    // using its own offset — a duplicate-pair member's offset is the same
    // at both ends, but a relationship fanned only at its shared target (or
    // source) — see `relFromOffset`/`relToOffset` above — must reserve
    // differently at each end, matching where its lane actually sits there.
    const cellW = rel.label ? labelCellWidth(rel.label) : 1
    const fromOffset =
      relColumnOffset.get(relIndex) ?? relFromOffset.get(relIndex) ?? 0
    const toOffset =
      relColumnOffset.get(relIndex) ?? relToOffset.get(relIndex) ?? 0
    const fromReach = columnReach.get(rel.from)!
    fromReach.left = Math.max(
      fromReach.left,
      Math.floor(cellW / 2) - fromOffset,
    )
    fromReach.right = Math.max(
      fromReach.right,
      fromOffset + cellW - 1 - Math.floor(cellW / 2),
    )
    const toReach = columnReach.get(rel.to)!
    toReach.left = Math.max(toReach.left, Math.floor(cellW / 2) - toOffset)
    toReach.right = Math.max(
      toReach.right,
      toOffset + cellW - 1 - Math.floor(cellW / 2),
    )
  })

  // Compute positions: each level is a row, classes in a row are spaced horizontally
  const placed = new Map<string, PlacedClass>()
  let currentY = 0
  // Right edge of the widest level's last slot — a slot can be wider than
  // its box, so the canvas has to cover the slot, not just the box.
  let maxSlotEnd = 0

  for (let lv = 0; lv <= maxLevel; lv++) {
    const group = levelGroups[lv]!
    if (group.length === 0) continue

    // --- #970's block-based x-assignment (issues #971, #972) ---
    // docs/decisions/ascii-class-diagram-x-coordinate-assignment-970.md.
    // Alignment blocks group classes at this level sharing the exact same
    // parent-id set, processed as a unit. A block's *qualifying* parents
    // are the subset strictly shallower than this level — a parent at the
    // same level (a rootless relationship cycle, whose members still
    // record each other as "parents" in `parents` even though nothing
    // above them ever resolves) never qualifies. A block with zero
    // qualifying parents has "no resolvable parents" and every member
    // keeps its plain left-to-right baseline position, computed
    // individually (not as a joint unit — #971's exact per-class
    // behavior, preserved verbatim for this shape, including when a
    // no-resolvable-parents block's members happen not to be declaration-
    // adjacent). A block with at least one qualifying parent computes a
    // real desired center: the mean of its qualifying parents' own,
    // already-placed box centers (a single qualifying parent's mean is
    // just that parent's center — the #964 repro exactly, #971's case; a
    // block of more than one class sharing that parent set spreads evenly
    // by centering the block's *total* width on that shared center, #972's
    // "multiple children of one parent" case; more than one qualifying
    // parent averages their centers, #972's "converging edges" case).
    // Either way, the block's desired *left* edge (its slot-space left,
    // matching `currentX`'s role below) is `desiredCenter -
    // floor(totalWidth / 2)` — floor chosen only for determinism. A single
    // left-to-right compaction pass then resolves any collision between
    // *any* two blocks' desired positions — universal across every block
    // shape, not just multi-parent ones, since two independently-aligned
    // singleton blocks can still want overlapping positions (#971) — by
    // only ever pushing a block right of its desired position, never left,
    // and never reordering blocks relative to each other.
    //
    // A class with no parents at all is always its own singleton block —
    // two unrelated roots must never be merged into one block just because
    // both happen to have an empty parent set; there is nothing shared to
    // align them around.
    const blockKeyOf = (id: string): string => {
      const pset = parents.get(id)
      return pset && pset.size > 0 ? [...pset].sort().join(',') : `root:${id}`
    }
    // Every member sharing a given block key, regardless of adjacency in
    // `group` — looked up once a block is actually confirmed to have a
    // shared center to align around (see the main loop below). Building
    // this eagerly for every id up front, and processing every block's
    // *entire* membership together the moment its first (in declaration
    // order) member is reached — even for a block with no resolvable
    // parents — used to silently reorder an unrelated class that was
    // declared between two same-parent-set siblings ahead of it, moving it
    // visually later than its own declaration position (caught in review
    // on #972). The main loop below only merges members into one placement
    // unit for a block that actually resolves to a shared center; a
    // no-resolvable-parents "block" is never merged, so it can't reorder
    // anything.
    const blockMembers = new Map<string, string[]>()
    for (const id of group) {
      const key = blockKeyOf(id)
      let members = blockMembers.get(key)
      if (!members) {
        members = []
        blockMembers.set(key, members)
      }
      members.push(id)
    }

    // Baseline: today's plain left-to-right slot position for every class
    // in this level, computed exactly as the pre-#971 algorithm did — the
    // fallback position for a no-resolvable-parents block's members, and
    // the starting point the compaction step below can only ever push
    // right of, never left.
    const baselineSlotLeft = new Map<string, number>()
    const slotWidthOf = new Map<string, number>()
    const leftPadOf = new Map<string, number>()
    {
      let x = 0
      for (const id of group) {
        const w = classBoxW.get(id)!
        // The box's center column sits `floor(w / 2)` cells from its left
        // edge (the same arithmetic `connectionColumns` uses), so anything
        // reaching further than that past the center overhangs the box.
        const reach = columnReach.get(id)!
        const leftPad = Math.max(0, reach.left - Math.floor(w / 2))
        const rightPad = Math.max(0, reach.right - (w - 1 - Math.floor(w / 2)))
        baselineSlotLeft.set(id, x)
        slotWidthOf.set(id, leftPad + w + rightPad)
        leftPadOf.set(id, leftPad)
        x += leftPad + w + rightPad + hGap
      }
    }

    let currentX = 0
    let maxH = 0

    /** Places one class's box at slot-left `slotLeft`, advancing `currentX`/`maxH`/`maxSlotEnd`. */
    const placeAt = (id: string, slotLeft: number): void => {
      const cls = classById.get(id)!
      const w = classBoxW.get(id)!
      const h = classBoxH.get(id)!
      const leftPad = leftPadOf.get(id)!
      const slotWidth = slotWidthOf.get(id)!
      placed.set(id, {
        cls,
        sections: classSections.get(id)!,
        // Shifted right only by the left overhang, so a box with nothing
        // reaching past its left edge lands exactly where its slot does.
        x: slotLeft + leftPad,
        y: currentY,
        width: w,
        height: h,
      })
      maxSlotEnd = Math.max(maxSlotEnd, slotLeft + slotWidth)
      currentX = slotLeft + slotWidth + hGap
      maxH = Math.max(maxH, h)
    }

    const placedThisLevel = new Set<string>()
    for (const id of group) {
      // Already placed as part of an earlier qualifying block's joint
      // placement below (never true for a no-resolvable-parents id, which
      // is always placed the moment the loop reaches it, in its own true
      // declaration-order turn).
      if (placedThisLevel.has(id)) continue

      const key = blockKeyOf(id)
      const pset = parents.get(id)
      // `level.get(pid)!`: every relationship endpoint is guaranteed a
      // `classById`/`level` entry (the parser's `ensureClass` auto-creates
      // an implicit class for any id used only as a relationship endpoint,
      // never just a dangling reference — see `classById.has(...)`'s own
      // guards elsewhere in this file, which protect a *different* case),
      // so this is never actually missing.
      const qualifying = pset
        ? [...pset].filter((pid) => level.get(pid)! < lv)
        : []

      if (qualifying.length === 0) {
        // No resolvable parents: this id has no shared center to align
        // around, so it is never merged into a joint block with the other
        // members `blockKeyOf` groups it with — only *this* id is placed
        // here, in its own true position in `group`'s declaration order,
        // exactly matching #971's per-class behavior for this shape. Any
        // other same-key member is placed independently, on its own later
        // turn through this same loop — merging them together here would
        // reorder whatever was declared between them ahead of its own
        // declaration position (issue caught in #972's review).
        const slotLeft = Math.max(baselineSlotLeft.get(id)!, currentX, 0)
        placeAt(id, slotLeft)
        placedThisLevel.add(id)
        continue
      }

      // A block with a real shared center to align around *is* placed as
      // a joint unit, gathering every member `blockKeyOf` groups with it
      // regardless of adjacency in `group` — the whole reason to group
      // same-parent-set siblings together in the first place.
      const members = blockMembers.get(key)!

      // `placed.get(...)!`: every id in `qualifying` has a strictly-
      // shallower level than `lv`, and this loop places every class of a
      // level before moving to the next, so a strictly-shallower class is
      // always already placed by the time this level is processed.
      // "Center column" is always a box's own rendered center, never the
      // reach-padded slot's — aligning to the slot center instead would
      // visually misalign the boxes whenever a relationship's label
      // overhang is asymmetric.
      const parentCenters = qualifying.map((pid) => {
        const p = placed.get(pid)!
        return p.x + Math.floor(p.width / 2)
      })
      const desiredCenter = Math.round(
        parentCenters.reduce((sum, c) => sum + c, 0) / parentCenters.length,
      )

      let totalWidth = 0
      for (let i = 0; i < members.length; i++) {
        totalWidth += slotWidthOf.get(members[i]!)!
        if (i < members.length - 1) totalWidth += hGap
      }
      // `totalWidth` is the *slot* span (every member's own reach padding
      // included at both ends), but the thing that must visually center on
      // `desiredCenter` is the *rendered box* span — from the first
      // member's own box left edge to the last member's own box right
      // edge, which excludes the outermost reach padding at each end (that
      // padding only ever separates a box from a *neighbor*; at the
      // block's own two ends there is no neighbor to separate from, so it
      // just becomes asymmetric dead space that would otherwise skew the
      // visible boxes off `desiredCenter` whenever the first member's
      // leftPad differs from the last member's rightPad — e.g. one child
      // has a long incoming label reserving room on its own left, the
      // other has none). Subtracting them back out here, once, is cheaper
      // than threading a separate "visible width" accumulator through the
      // loop above (caught in #972's review).
      const firstLeftPad = leftPadOf.get(members[0]!)!
      const lastMember = members[members.length - 1]!
      const lastRightPad =
        slotWidthOf.get(lastMember)! -
        leftPadOf.get(lastMember)! -
        classBoxW.get(lastMember)!
      const visibleWidth = totalWidth - firstLeftPad - lastRightPad
      const blockDesiredLeft =
        desiredCenter - firstLeftPad - Math.floor(visibleWidth / 2)
      const blockActualLeft = Math.max(blockDesiredLeft, currentX, 0)

      let memberX = blockActualLeft
      for (const memberId of members) {
        placeAt(memberId, memberX)
        placedThisLevel.add(memberId)
        memberX = currentX
      }
    }

    const gapRows =
      vGap +
      (labelRoomLevels.has(lv) ? LABEL_EXTRA_VGAP : 0) +
      (detourRoomLevels?.has(lv) ? DETOUR_EXTRA_VGAP : 0)
    currentY += maxH + Math.max(gapRows, cardinalityGapByLevel.get(lv) ?? 0)
  }

  // Centre each interface name on its host so the stem runs straight, unless
  // a neighbour on the name's row is in the way.
  for (const [id, lolli] of lollipops) {
    const p = placed.get(id)
    const host = placed.get(lolli.host)
    if (!p || !host) continue
    // Match the floor(width / 2) centre column edges attach to, so an odd/even
    // width pair still gets a straight stem instead of a one-column jog.
    const x = host.x + Math.floor(host.width / 2) - Math.floor(p.width / 2)
    const clear = [...placed.values()].every(
      (o) =>
        o === p ||
        o.y + o.height <= p.y ||
        o.y >= p.y + p.height ||
        o.x + o.width + 1 <= x ||
        o.x >= x + p.width + 1,
    )
    if (x >= 0 && clear) p.x = x
  }

  // --- Frame rectangles ---
  // Each frame wraps the boxes of its members; the whole diagram shifts
  // right/down so the outermost frame's border lands on the canvas.
  interface FrameRect {
    name: string
    x0: number
    y0: number
    x1: number
    y1: number
  }
  const frameRects: FrameRect[] = []
  if (cardinalityLeftPad > 0) {
    for (const p of placed.values()) p.x += cardinalityLeftPad
    maxSlotEnd += cardinalityLeftPad
  }
  if (frames.length > 0) {
    for (const p of placed.values()) {
      p.x += FRAME_SIDE_PAD
      p.y += FRAME_TOP_PAD
    }
    maxSlotEnd += FRAME_SIDE_PAD
    const extent = (
      fr: AsciiNamespaceFrame,
    ): { minX: number; minY: number; maxX: number; maxY: number } => {
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const id of fr.ids) {
        const p = placed.get(id)
        if (!p) continue
        minX = Math.min(minX, p.x)
        minY = Math.min(minY, p.y)
        maxX = Math.max(maxX, p.x + p.width - 1)
        maxY = Math.max(maxY, p.y + p.height - 1)
      }
      return { minX, minY, maxX, maxY }
    }
    // A frame is the bounding box of its members, so members of two frames
    // can interleave (a child placed between parents from another frame) and
    // the boxes overlap. Push the right-hand frame, and everything right of
    // it that is not in the left-hand frame, clear of the left-hand one.
    const nsIds = (fr: AsciiNamespaceFrame): Set<string> => new Set(fr.ids)
    for (let pass = 0; pass <= frames.length * frames.length; pass++) {
      let moved = false
      for (const a of frames) {
        for (const b of frames) {
          if (a === b) continue
          const ea = extent(a)
          const eb = extent(b)
          const yOverlap =
            ea.minY - FRAME_TOP_PAD <= eb.maxY + FRAME_BOTTOM_PAD &&
            eb.minY - FRAME_TOP_PAD <= ea.maxY + FRAME_BOTTOM_PAD
          const delta = ea.maxX + 2 * FRAME_SIDE_PAD + 2 - eb.minX
          // `b` is the frame starting right of `a`'s start.
          if (!yOverlap || eb.minX < ea.minX || delta <= 0) continue
          const inA = nsIds(a)
          for (const p of placed.values()) {
            if (!inA.has(p.cls.id) && p.x >= eb.minX) p.x += delta
          }
          maxSlotEnd += delta
          moved = true
        }
      }
      if (!moved) break
    }
    for (const fr of frames) {
      const { minX, minY, maxX, maxY } = extent(fr)
      if (minX === Infinity) continue
      const x0 = minX - FRAME_SIDE_PAD
      // Wide enough for ` Title ` between the corners, plus a dash each side.
      const x1 = Math.max(maxX + FRAME_SIDE_PAD, x0 + displayWidth(fr.name) + 5)
      frameRects.push({
        name: fr.name,
        x0,
        y0: minY - FRAME_TOP_PAD,
        x1,
        y1: maxY + FRAME_BOTTOM_PAD,
      })
    }
  }

  // --- Create canvas ---
  let totalW = maxSlotEnd
  for (const r of frameRects) totalW = Math.max(totalW, r.x1 + 1)
  let totalH = 0
  for (const p of placed.values()) {
    totalW = Math.max(totalW, p.x + p.width)
    totalH = Math.max(totalH, p.y + p.height)
  }
  for (const r of frameRects) totalH = Math.max(totalH, r.y1 + 1)

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

  // Opt-in OSC 8 hyperlinks (see hyperlinks.ts): the link canvas is sized to
  // the main canvas, so a cell clipped by the `cx < totalW` guard below is
  // clipped here too.
  const linkCanvas: LinkCanvas | undefined = options.hyperlinks
    ? mkLinkCanvas(totalW - 1, totalH - 1)
    : undefined

  // --- Draw class boxes ---
  for (const p of placed.values()) {
    if (lollipops.has(p.cls.id)) {
      const cells = toDisplayCells(p.cls.label)
      for (const [i, cell] of cells.entries()) setC(p.x + i, p.y, cell, 'text')
      continue
    }
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

    // A `click` href links the class-name line(s) of the header section —
    // box row 1 is the first header line, which is the `<<annotation>>`
    // when there is one, so the name starts on the row after it. The SVG
    // renderer wraps the whole class box in an <a>; in a terminal, the name
    // is the natural analog of "the label".
    if (linkCanvas) {
      const href = safeHref(diagram.interactions.get(p.cls.id)?.href)
      const header = p.sections[0]
      if (href !== undefined && header !== undefined) {
        const nameRowStart = 1 + (p.cls.annotation ? 1 : 0)
        markBoxLabelLinks(linkCanvas, boxCanvas, { x: p.x, y: p.y }, href, {
          from: nameRowStart,
          to: header.length,
        })
      }
    }
  }

  // --- Snapshot cells occupied by class boxes ---
  // Taken once, right after boxes are drawn and before any relationship
  // line, corner, marker, or label is drawn — the class-diagram analog of
  // the `boxCells`/`setCGuarded` guard er-diagram.ts gained for issue #350.
  // Two independent routing branches rely on it:
  // - The cross-level ("target below"/"target above") branches, whose
  //   routing can jog a long way horizontally with no prior occupancy
  //   check — e.g. connecting a level-1 child to a level-0 parent whose
  //   column sits far from an intervening, taller same-level sibling's
  //   box, which the jog then cuts straight through.
  // - The same-level branch's own detour (this file's final `else`), which
  //   primarily avoids a same-row obstruction by computing its detour row
  //   from this same box geometry (see `obstructionBottom` there); this
  //   snapshot is the last-resort backstop for whatever that routing
  //   doesn't anticipate.
  const boxCells = new Set<string>()
  for (const p of placed.values()) {
    for (let by = 0; by < p.height; by++) {
      for (let bx = 0; bx < p.width; bx++) {
        boxCells.add(`${p.x + bx},${p.y + by}`)
      }
    }
  }

  /**
   * Like setC, but refuses to draw into a cell already occupied by a class
   * box (see boxCells above). Used by both the cross-level relationship
   * branches (where a mis-routed jog can cut straight through an
   * unrelated, taller same-level box) and the same-level branch's own
   * detour (a last-resort backstop for whatever its obstruction-aware
   * routing doesn't anticipate — see `obstructionBottom` below), so either
   * kind of mis-routed segment degrades to a gap in the line rather than
   * corrupting a box's border or attribute/method text.
   */
  function setCGuarded(x: number, y: number, ch: string, role: CharRole): void {
    if (boxCells.has(`${x},${y}`)) return
    setC(x, y, ch, role)
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

  // Vertical runs of detours already routed, so a later detour takes its own
  // column instead of drawing over theirs.
  const detourLanes: { x: number; y1: number; y2: number }[] = []

  /** Find a clear vertical column for routing that doesn't pass through any boxes */
  function findClearColumn(
    startX: number,
    y1: number,
    y2: number,
    excludeIds: Set<string>,
  ): number {
    const columnIsClear = (x: number): boolean => {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        if (isInsideBox(x, y, excludeIds)) return false
      }
      // A detour column other than the straight one must not run along
      // another detour's column or a frame's side border.
      return (
        x === startX ||
        (!detourLanes.some((l) => l.x === x && l.y1 <= y2 && y1 <= l.y2) &&
          !frameRects.some(
            (r) => (x === r.x0 || x === r.x1) && r.y0 <= y2 && y1 <= r.y1,
          ))
      )
    }

    // Scan outward from `startX`, right before left at each distance, never
    // off the left edge of the canvas. The right bound reaches far enough
    // past the widest box that a column clear of every box is always found
    // in practice — but the caller-side fallback below stays as a backstop
    // rather than being asserted away.
    return (
      findFreeLane(startX, 0, startX + totalW + 9, columnIsClear) ?? totalW + 2
    )
  }

  // --- Draw relationship lines ---
  const H = useAscii ? '-' : '─'
  const V = useAscii ? '|' : '│'
  const dashH = useAscii ? '.' : '╌'
  const dashV = useAscii ? ':' : '┊'

  /**
   * Offset from a box's center column to the *anchor* where one
   * relationship's line touches that box's border — always within the
   * box's own width, so a line visibly leaves from (or arrives at) the box
   * rather than from empty space beside it. This is the only place the
   * per-pair offset is reined in: the *lane* the line then runs along
   * keeps the full offset (see `connectionColumns`), which the column
   * reservation in the layout pass guarantees room for.
   *
   * A group whose lanes fan out wider than the box has its anchors spread
   * evenly across the box's full width (corner columns included) by
   * scaling the whole group down by one factor, so as many relationships
   * as the box has columns keep a distinct border cell — and so a distinct
   * arrowhead. Clamping each lane on its own instead collapsed every outer
   * lane onto the same edge column, which is exactly how #489's four
   * relationships ended up sharing two connection points. Only a group
   * with more members than the box has columns still has to share.
   */
  function anchorOffset(
    offset: number,
    spread: number,
    boxWidth: number,
    groupSize: number,
  ): number {
    // Columns available on each side of the center — the center itself is
    // `floor(boxWidth / 2)` in from the left edge, matching `connectionColumns`.
    // Corner cells hold the border glyphs, so an arrowhead there reads as
    // sitting beside the box rather than on it (#2335): keep anchors
    // inside the corners whenever the box has an interior to spare.
    // A group with more members than the interior has cells (#489) needs
    // the corner columns to keep its arrowheads distinct, so it keeps them.
    const trim = boxWidth >= 3 && groupSize <= boxWidth - 2 ? 1 : 0
    const left = Math.floor(boxWidth / 2) - trim
    const right = boxWidth - 1 - Math.floor(boxWidth / 2) - trim
    const scale = spread > left + right ? (left + right) / spread : 1
    return Math.max(-left, Math.min(right, Math.round(offset * scale)))
  }

  /**
   * Connection columns for one relationship, shifted by its per-pair offset.
   *
   * `fromCX`/`toCX` are the *lanes*: the columns the line's vertical run,
   * arrowhead-side jog, and label all sit on. They carry the full offset,
   * so relationships in a group never share a lane. Every pass that
   * positions something relative to a relationship's route — the
   * line-drawing loop, the label-territory precompute, and the
   * label-drawing pass — must go through this one helper and use these
   * lanes, so the label ends up on the same column the line actually runs
   * along. When only the line pass applied the offset (an earlier version
   * of this fix), a reciprocal pair's labels were still measured and drawn
   * against the shared box center: the territory pass saw two labels with
   * identical midpoints and split the column between them, truncating both
   * to a single mashed `rea……ies` while their lines sat on separate columns
   * (issue #448).
   *
   * `fromAnchorX`/`toAnchorX` are where the line meets each box border —
   * the lane pulled back inside the box (see `anchorOffset`). When a group
   * fans out wider than a narrow box (issue #489: four relationships
   * between two single-letter classes), a lane can sit well outside the
   * box; the line then jogs horizontally along the row adjacent to the box
   * from the anchor out to its lane (see `drawJog`) instead of the lanes
   * being collapsed onto the few columns the box has, which made distinct
   * relationships overwrite one another. Relationships may end up sharing
   * an anchor when a group outnumbers the box's columns — that's fine,
   * their jogs merge into a small trunk at the border — but never a lane.
   * Labels always use the lane, never the anchor: only the line's
   * box-border touchpoint needs pulling back inside the box.
   *
   * The offset applied at each end is resolved independently: a
   * relationship in a duplicate-pair group (`relColumnOffset`) uses that
   * same offset at both ends, as before, but one that only shares a single
   * endpoint with other relationships (`relFromOffset`/`relToOffset` — see
   * their doc comment above) is fanned at that shared end only, leaving its
   * other, unrelated end anchored on its own box center (issue #632).
   */
  function connectionColumns(
    relIndex: number,
    fromP: PlacedClass,
    toP: PlacedClass,
  ): {
    fromCX: number
    toCX: number
    fromAnchorX: number
    toAnchorX: number
  } {
    const fromOffset =
      relColumnOffset.get(relIndex) ?? relFromOffset.get(relIndex) ?? 0
    const toOffset =
      relColumnOffset.get(relIndex) ?? relToOffset.get(relIndex) ?? 0
    const fromSpread =
      relGroupSpread.get(relIndex) ?? relFromSpread.get(relIndex) ?? 0
    const toSpread =
      relGroupSpread.get(relIndex) ?? relToSpread.get(relIndex) ?? 0
    const fromSize =
      relGroupSize.get(relIndex) ?? relFromSize.get(relIndex) ?? 0
    const toSize = relGroupSize.get(relIndex) ?? relToSize.get(relIndex) ?? 0
    const fromCenter = fromP.x + Math.floor(fromP.width / 2)
    const toCenter = toP.x + Math.floor(toP.width / 2)
    return {
      fromCX: fromCenter + fromOffset,
      toCX: toCenter + toOffset,
      fromAnchorX:
        fromCenter +
        anchorOffset(fromOffset, fromSpread, fromP.width, fromSize),
      toAnchorX: toCenter + anchorOffset(toOffset, toSpread, toP.width, toSize),
    }
  }

  /**
   * Write one cell of a jog, merging with whatever another relationship's
   * jog already drew there. Jogs of one group all run along the same row
   * next to the box, so they routinely overlap: two relationships sharing
   * an anchor stack their corners on one cell, and an outer relationship's
   * jog passes straight through an inner one's lane corner. Compositing
   * box-drawing glyphs (`─` over `┌` → `┬`, `┘` over `┘` → `┘`) turns those
   * overlaps into a readable trunk instead of the last write winning. A
   * marker glyph already placed by an earlier relationship is left alone —
   * an arrowhead at a shared anchor doubles as the junction.
   */
  function setJogCell(x: number, y: number, ch: string, role: CharRole): void {
    if (boxCells.has(`${x},${y}`)) return
    if (rc[x]?.[y] === 'arrow') return
    const existing = canvas[x]?.[y]
    if (
      !useAscii &&
      existing !== undefined &&
      isJunctionChar(existing) &&
      isJunctionChar(ch)
    ) {
      const merged = mergeJunctions(existing, ch)
      setC(x, y, merged, merged === ch ? role : 'junction')
      return
    }
    setC(x, y, ch, role)
  }

  /**
   * Draw a detour's horizontal run on `row` between two columns, merging
   * with lines already there. The ends are corners (`startCorner` at `x1`,
   * `endCorner` at `x2`) in unicode, plain line glyphs otherwise.
   */
  function drawRun(
    row: number,
    x1: number,
    x2: number,
    startCorner: string,
    endCorner: string,
    lineH: string,
  ): void {
    const corners = !useAscii
    for (let x = Math.min(x1, x2) + 1; x < Math.max(x1, x2); x++) {
      // A dashed vertical crossing the run stays whole (it is the stem of a
      // head just below); a solid one merges into `┼`.
      if (canvas[x]?.[row] !== dashV) setJogCell(x, row, lineH, 'line')
    }
    setJogCell(
      x1,
      row,
      corners ? startCorner : lineH,
      corners ? 'corner' : 'line',
    )
    setJogCell(
      x2,
      row,
      corners ? endCorner : lineH,
      corners ? 'corner' : 'line',
    )
  }

  /**
   * Draw the short horizontal jog that joins a relationship's anchor on a
   * box border to the lane its line runs along, on the row directly
   * adjacent to that border. `boxIsAbove` says which side of the row the
   * box sits on: the anchor's corner opens toward the box, the lane's
   * corner opens the other way, toward the vertical run. A relationship
   * whose lane already sits inside its box needs no jog at all, which keeps
   * every pre-existing (unfanned) layout byte-identical.
   */
  function drawJog(
    row: number,
    anchorX: number,
    laneX: number,
    lineH: string,
    boxIsAbove: boolean,
  ): void {
    if (anchorX === laneX) return
    const lx = Math.min(anchorX, laneX)
    const rx = Math.max(anchorX, laneX)
    // Interior cells only — the two ends are corners (or, in plain-ASCII
    // mode, the same line glyph), written separately so a second jog
    // sharing this anchor merges with the corner instead of flattening it.
    for (let x = lx + 1; x < rx; x++) {
      setJogCell(x, row, lineH, 'line')
    }
    if (useAscii) {
      setJogCell(anchorX, row, lineH, 'line')
      setJogCell(laneX, row, lineH, 'line')
      return
    }
    const laneIsRight = laneX > anchorX
    const anchorCorner = boxIsAbove
      ? laneIsRight
        ? '└'
        : '┘'
      : laneIsRight
        ? '┌'
        : '┐'
    const laneCorner = boxIsAbove
      ? laneIsRight
        ? '┐'
        : '┌'
      : laneIsRight
        ? '┘'
        : '└'
    setJogCell(anchorX, row, anchorCorner, 'corner')
    setJogCell(laneX, row, laneCorner, 'corner')
  }

  // A detoured relationship's actual routed path — the far column its
  // vertical trunk runs along, and the rows its horizontal jogs sit on —
  // keyed by relationship index. The line-drawing pass below is the only
  // place that decides whether (and where) a relationship detours, but the
  // label-territory precompute and label-drawing passes further down need
  // that same decision too, so they can anchor a detoured relationship's
  // label on its real path instead of the straight-line source/target
  // midpoint (issue #487). Populated only for the "target below source,
  // needs a detour around an intermediate box" case — the only routing
  // branch that currently detours at all.
  const detourRoutes = new Map<
    number,
    {
      routeX: number
      exitY: number
      entryY: number
      fromAnchorX: number
      toAnchorX: number
      clearSide: 'left' | 'right'
    }
  >()

  // Same-level relationships' obstruction-aware detour row (issue #953),
  // keyed by relationship index — `computeLabelAnchor`'s own same-level
  // branch reads this so a labeled same-level relationship's label anchors
  // on the same corrected row the connector itself routes through, instead
  // of recomputing the naive (obstruction-unaware) `Math.max(fromBY, toBY)
  // + 2` and landing back inside whatever box the connector fix was
  // routing around.
  const sameLevelDetourY = new Map<number, number>()

  // Levels whose gap below holds a detour's entry run. The first layout
  // pass collects them; a second pass re-lays out with extra rows there.
  const detourEntryLevels = new Set<number>()

  // Detour drawing runs after every other relationship, so it can see the
  // straight stems already on the canvas at the anchor it shares.
  const lateDetours: (() => void)[] = []

  // Where each relationship's two ends touch their boxes — the marker cell
  // (or the stem cell when that end has no marker) and which way the line
  // runs away from the box (+1 down, -1 up). The cardinality pass reads it.
  interface RelEnd {
    x: number
    y: number
    dy: 1 | -1
  }
  const relEnds = new Map<number, { from: RelEnd; to: RelEnd }>()

  diagram.relationships.forEach((rel, relIndex) => {
    const fromP = placed.get(rel.from)
    const toP = placed.get(rel.to)
    if (!fromP || !toP) return

    const marker = getRelMarker(rel.type, rel.markerAt)
    const lineH = marker.dashed ? dashH : H
    const lineV = marker.dashed ? dashV : V

    // Exclude source and target boxes from collision detection
    const excludeIds = new Set([rel.from, rel.to])

    // Connection points: the lanes the line runs along (`fromCX`/`toCX`)
    // and the anchors where it touches each box border — see
    // `connectionColumns` for why those can differ.
    const cols = connectionColumns(relIndex, fromP, toP)
    const { fromCX, toCX, fromAnchorX } = cols
    let toAnchorX = cols.toAnchorX
    const fromBY = fromP.y + fromP.height - 1
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
        // Path: source anchor → horizontal to routeX → vertical to entry → horizontal to target anchor
        // The horizontals start/end at the *anchors* (on the box borders),
        // so a fanned-out lane needs no separate jog here — the detour's
        // own horizontal already runs along the jog row.

        // Skip-level edges aren't in the fan-out group, so step the anchor
        // off any column another edge into this box already uses.
        const taken = new Set<number>()
        diagram.relationships.forEach((other, i) => {
          const otherFrom = placed.get(other.from)
          if (i !== relIndex && other.to === rel.to && otherFrom) {
            taken.add(connectionColumns(i, otherFrom, toP).toAnchorX)
          }
        })
        const step = routeX > toAnchorX ? 1 : -1
        for (
          let x = toAnchorX + step;
          taken.has(toAnchorX) && x > toP.x && x < toP.x + toP.width - 1;
          x += step
        ) {
          if (!taken.has(x)) toAnchorX = x
        }
        const exitY = fromBY + 1
        const entryY = toTY - 1
        detourLanes.push({ x: routeX, y1: exitY, y2: entryY })
        detourRoutes.set(relIndex, {
          routeX,
          exitY,
          entryY,
          fromAnchorX,
          toAnchorX,
          // `findClearColumn` starts its search at `fromCX` and only
          // returns a different column when that one collided with a box
          // over the route's full y-range — so whichever side it moved
          // toward is the side with clearance, and the box it moved away
          // from sits on the other side of `routeX`. The label-anchor pass
          // uses this to keep a detour label's whole width clear of that
          // box, not just the single column `routeX` itself.
          clearSide: routeX > fromCX ? 'right' : 'left',
        })

        relEnds.set(relIndex, {
          from: { x: fromAnchorX, y: fromBY + 1, dy: 1 },
          to: { x: toAnchorX, y: entryY, dy: -1 },
        })

        // Drawn after every other relationship (see `lateDetours`).
        lateDetours.push(() => {
          // The entry run sits one row above the arrowhead row, so the head
          // has a stem above it. The first layout pass may lack the room
          // (its result is discarded below); the second pass always has it.
          // A frame's top border sits on that row for a box at the frame's
          // top, so the run goes one row higher instead of along the border.
          const onBorder = frameRects.some(
            (r) =>
              r.y0 === entryY - 1 && toAnchorX >= r.x0 && toAnchorX <= r.x1,
          )
          const runY = entryY - (onBorder ? 2 : 1)
          if (routeX !== toAnchorX) {
            detourEntryLevels.add(level.get(rel.to)! - 1)
          }

          // 1. Horizontal from source anchor to route column. When another
          //    relationship's straight stem already leaves the same anchor, the
          //    run starts a row lower so the stem stays a plain `│` and the run
          //    branches off it (`├`), instead of a corner replacing the stem.
          const sharesStem = [V, dashV].includes(canvas[fromAnchorX]![exitY]!)
          const exitRunY = sharesStem ? exitY + 1 : exitY
          drawRun(
            exitRunY,
            fromAnchorX,
            routeX,
            fromAnchorX < routeX ? '└' : '┘',
            fromAnchorX < routeX ? '┐' : '┌',
            lineH,
          )

          // 2. Vertical at routeX from exit to the entry run
          const trunkEnd = routeX !== toAnchorX ? runY - 1 : entryY
          for (let y = exitRunY + 1; y <= trunkEnd; y++) {
            setCGuarded(routeX, y, lineV, 'line')
          }

          // 3. Horizontal from routeX to target anchor at the entry run; its
          //    corner at the anchor is the stem top above the arrowhead
          if (routeX !== toAnchorX) {
            drawRun(
              runY,
              routeX,
              toAnchorX,
              routeX < toAnchorX ? '└' : '┘',
              routeX < toAnchorX ? '┐' : '┌',
              lineH,
            )
            for (let y = runY + 1; y < entryY; y++) {
              setCGuarded(toAnchorX, y, lineV, 'line')
            }
          }

          // Markers for detour case
          if (marker.markerAt !== 'from') {
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
            setCGuarded(toAnchorX, entryY, markerChar, 'arrow')
          }
          if (marker.markerAt !== 'to') {
            const markerChar = getFromMarkerShape(marker.type, useAscii, 'down')
            setCGuarded(fromAnchorX, fromBY + 1, markerChar, 'arrow')
          }
        })
      } else {
        // NO COLLISION CASE: Use original midpoint-based routing
        // Path: source anchor → (jog to lane) → vertical to midY → horizontal at midY → vertical → (jog to anchor) → target
        //
        // The jogs only exist when a lane sits outside its box; otherwise
        // anchor and lane coincide and the path is the plain three-segment
        // route. With the default vertical gap the from-jog row, midY, and
        // the to-jog row are the three rows between the boxes, so a fanned
        // group reads as a trunk under the source, labels on the lanes,
        // and a trunk gathering back into the target.

        const midY = fromBY + Math.floor((toTY - fromBY) / 2)
        const fromJogs = fromCX !== fromAnchorX
        const toJogs = toCX !== toAnchorX
        relEnds.set(relIndex, {
          from: { x: fromAnchorX, y: fromBY + 1, dy: 1 },
          to: { x: toAnchorX, y: toTY - 1, dy: -1 },
        })

        // 1. Jog from the source anchor out to the lane, then vertical from
        //    the source bottom (or from below the jog) to midY
        drawJog(fromBY + 1, fromAnchorX, fromCX, lineH, true)
        for (let y = fromBY + (fromJogs ? 2 : 1); y <= midY; y++) {
          setCGuarded(fromCX, y, lineV, 'line')
        }

        // 2. Horizontal from fromCX to toCX at midY (if needed)
        //
        // This segment matters most for the boxCells guard: it can travel
        // a long way horizontally when the target's column sits far from
        // the source's (e.g. a level-1 child positioned under a completely
        // different level-0 sibling than its own parent). Nothing about
        // `findClearColumn` finding `fromCX` itself clear (the only check
        // that decided this is the no-collision branch) says the *row*
        // this horizontal run lands on is clear all the way over to
        // `toCX` too — a taller same-level sibling sitting between them,
        // extending below its own row's shortest box, is exactly the case
        // that check misses.
        if (fromCX !== toCX && midY < (canvas[0]?.length ?? 0)) {
          const lx = Math.min(fromCX, toCX)
          const rx = Math.max(fromCX, toCX)
          for (let x = lx; x <= rx; x++) {
            setCGuarded(x, midY, lineH, 'line')
          }
          if (!useAscii) {
            setCGuarded(fromCX, midY, fromCX < toCX ? '└' : '┘', 'corner')
            setCGuarded(toCX, midY, fromCX < toCX ? '┐' : '┌', 'corner')
          }
        }

        // 3. Vertical from midY to the target top (or to above the jog),
        //    then jog from the lane back in to the target anchor
        for (let y = midY + 1; y < toTY - (toJogs ? 1 : 0); y++) {
          setCGuarded(toCX, y, lineV, 'line')
        }
        drawJog(toTY - 1, toAnchorX, toCX, lineH, false)

        // Markers for no-collision case
        if (marker.markerAt !== 'from') {
          // Same rotation compensation as the detour case above — target is
          // below this point, so hierarchical markers need 'up' to point
          // down into it.
          const isHierarchical =
            marker.type === 'inheritance' || marker.type === 'realization'
          setCGuarded(
            toAnchorX,
            toTY - 1,
            getMarkerShape(
              marker.type,
              useAscii,
              isHierarchical ? 'up' : 'down',
            ),
            'arrow',
          )
        }
        if (marker.markerAt !== 'to') {
          setCGuarded(
            fromAnchorX,
            fromBY + 1,
            getFromMarkerShape(marker.type, useAscii, 'down'),
            'arrow',
          )
        }
      }
    } else if (toP.y + toP.height - 1 < fromP.y) {
      // Target is ABOVE source — draw upward from source top to target bottom
      const fromTY = fromP.y
      const toBY = toP.y + toP.height - 1
      const midY = toBY + Math.floor((fromTY - toBY) / 2)
      const fromJogs = fromCX !== fromAnchorX
      const toJogs = toCX !== toAnchorX
      relEnds.set(relIndex, {
        from: { x: fromAnchorX, y: fromTY - 1, dy: -1 },
        to: { x: toAnchorX, y: toBY + 1, dy: 1 },
      })

      // Jog along the row above the source from its anchor out to the lane
      // (mirror of the downward case), then vertical up to midY
      drawJog(fromTY - 1, fromAnchorX, fromCX, lineH, false)
      for (let y = fromTY - (fromJogs ? 2 : 1); y >= midY; y--) {
        setCGuarded(fromCX, y, lineV, 'line')
      }

      // This branch has no collision-avoidance routing at all (unlike the
      // "target below source" branch above, which at least tries
      // `findClearColumn` first) — it always draws the straight
      // jog/vertical/horizontal/vertical/jog path. The boxCells guard is
      // this path's only protection against a horizontal run landing on
      // an unrelated box; see the equivalent midY comment in the "target
      // below source" branch above for why that's a real, not merely
      // theoretical, case.
      if (fromCX !== toCX) {
        const lx = Math.min(fromCX, toCX)
        const rx = Math.max(fromCX, toCX)
        for (let x = lx; x <= rx; x++) {
          setCGuarded(x, midY, lineH, 'line')
        }
        if (!useAscii && midY >= 0 && midY < totalH) {
          setCGuarded(fromCX, midY, fromCX < toCX ? '┌' : '┐', 'corner')
          setCGuarded(toCX, midY, fromCX < toCX ? '┘' : '└', 'corner')
        }
      }

      for (let y = midY - 1; y > toBY + (toJogs ? 1 : 0); y--) {
        setCGuarded(toCX, y, lineV, 'line')
      }
      drawJog(toBY + 1, toAnchorX, toCX, lineH, true)

      // Draw markers - arrows point in the direction of the vertical segment (upward)
      if (marker.markerAt !== 'to') {
        const markerChar = getFromMarkerShape(marker.type, useAscii, 'up')
        const my = fromTY - 1
        for (let i = 0; i < markerChar.length; i++) {
          setCGuarded(
            fromAnchorX - Math.floor(markerChar.length / 2) + i,
            my,
            markerChar[i]!,
            'arrow',
          )
        }
      }
      if (marker.markerAt !== 'from') {
        const isHierarchical =
          marker.type === 'inheritance' || marker.type === 'realization'
        const markerDir = isHierarchical ? 'down' : 'up'
        const markerChar = getMarkerShape(marker.type, useAscii, markerDir)
        const my = toBY + 1
        for (let i = 0; i < markerChar.length; i++) {
          setCGuarded(
            toAnchorX - Math.floor(markerChar.length / 2) + i,
            my,
            markerChar[i]!,
            'arrow',
          )
        }
      }
    } else {
      // Same level — draw horizontal line with a detour below both boxes.
      const toBY = toP.y + toP.height - 1
      const lx = Math.min(fromCX, toCX)
      const rx = Math.max(fromCX, toCX)

      // The naive detour row — max(fromBY, toBY) + 2 — is derived only from
      // this relationship's own two endpoints. A same-level layout puts
      // every class in the level on one shared row (see the placement loop
      // above), so a relationship cycle that can't be linearly leveled
      // (e.g. A->B->C->A) lands a third, unrelated class between `fromP`
      // and `toP` in that same row. When that in-between class is taller
      // than both endpoints (more attributes/methods), the naive detour row
      // sits *above* its bottom edge, and the horizontal segment below
      // (spanning [lx, rx], which crosses straight through that class's
      // x-range) cuts through its box instead of running beneath it.
      // Search for any such same-row obstruction and route the detour below
      // its bottom edge too — generalizing er-diagram.ts's obstructionBottom
      // search (issue #350) to class diagrams' same-level detour.
      let obstructionBottom = Math.max(fromBY, toBY)
      for (const [id, other] of placed.entries()) {
        if (id === rel.from || id === rel.to) continue
        if (other.y !== fromP.y) continue
        const overlapsGap = other.x < rx + 1 && other.x + other.width > lx
        if (overlapsGap) {
          obstructionBottom = Math.max(
            obstructionBottom,
            other.y + other.height - 1,
          )
        }
      }
      const detourY = obstructionBottom + 2
      sameLevelDetourY.set(relIndex, detourY)
      increaseSize(canvas, totalW, detourY + 1)
      increaseRoleCanvasSize(rc, totalW, detourY + 1)
      const fromJogs = fromCX !== fromAnchorX
      const toJogs = toCX !== toAnchorX
      relEnds.set(relIndex, {
        from: { x: fromAnchorX, y: fromBY + 1, dy: 1 },
        to: { x: toAnchorX, y: toBY + 1, dy: 1 },
      })

      // Jog out to the lane under the source, then vertical down from it
      drawJog(fromBY + 1, fromAnchorX, fromCX, lineH, true)
      for (let y = fromBY + (fromJogs ? 2 : 1); y <= detourY; y++) {
        setCGuarded(fromCX, y, lineV, 'line')
      }
      // Horizontal
      for (let x = lx; x <= rx; x++) {
        setCGuarded(x, detourY, lineH, 'line')
      }
      // Vertical up to target, then jog back in to its anchor
      for (let y = detourY - 1; y >= toBY + (toJogs ? 2 : 1); y--) {
        setCGuarded(toCX, y, lineV, 'line')
      }
      drawJog(toBY + 1, toAnchorX, toCX, lineH, true)

      // Draw markers - same-level routing uses vertical segments at both ends
      if (marker.markerAt !== 'to') {
        const markerChar = getFromMarkerShape(marker.type, useAscii, 'down')
        const my = fromBY + 1
        for (let i = 0; i < markerChar.length; i++) {
          setCGuarded(
            fromAnchorX - Math.floor(markerChar.length / 2) + i,
            my,
            markerChar[i]!,
            'arrow',
          )
        }
      }
      if (marker.markerAt !== 'from') {
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
          setCGuarded(
            toAnchorX - Math.floor(markerChar.length / 2) + i,
            my,
            markerChar[i]!,
            'arrow',
          )
        }
      }
    }
  })

  for (const draw of lateDetours) draw()

  // A detour was routed with no room for its arrowhead stem: lay out again
  // with extra rows there (at most once).
  if (!detourRoomLevels && detourEntryLevels.size > 0) {
    return renderClassAscii(
      text,
      config,
      colorMode,
      theme,
      options,
      detourEntryLevels,
      cardinalityLeftPad,
    )
  }

  /**
   * Where a relationship's label should ideally center — the column and row
   * the territory precompute and label-drawing passes below both anchor on.
   *
   * For the common case (no detour), this is the straight-line midpoint
   * between the source and target connection columns/rows, same as before.
   *
   * For a relationship whose line detours around an intermediate box (see
   * `detourRoutes` above), the label instead anchors on the *actual routed
   * path*: beside the midpoint of the detour's vertical trunk (the longest
   * segment in the common case), or — when the boxes are close enough
   * together that the trunk has no vertical room at all — the midpoint of
   * whichever horizontal jog is longer. Anchoring at the straight-line
   * midpoint ignored the detour entirely, so a detoured relationship's
   * label could land in the same column (and even the same row) as an
   * unrelated relationship's straight-line label, reading as though both
   * terminated at the same box (issue #487).
   *
   * `labelWidth` (the padded display width the caller is about to draw)
   * matters for the vertical-trunk case specifically: `findClearColumn`
   * only guarantees the single column `routeX` is clear of boxes over the
   * trunk's row range, not a whole label-width window centered on it. A
   * label centered directly on `routeX` routinely re-overlapped the very
   * box the trunk was routed around to avoid — visible as the label
   * appearing to collide with (or get shoved off) the box the trunk hugs.
   * `detour.clearSide` says which side of `routeX` is the side
   * `findClearColumn` actually found clear (see its call site), so the
   * label is anchored flush against the trunk on that side instead of
   * straddling it.
   */
  function computeLabelAnchor(
    relIndex: number,
    fromP: PlacedClass,
    toP: PlacedClass,
    labelWidth: number,
    lineCount: number,
  ): { idealMidX: number; baseMidY: number } {
    const { fromCX, toCX, toAnchorX } = connectionColumns(relIndex, fromP, toP)
    const fromBY = fromP.y + fromP.height - 1
    const toTY = toP.y

    if (fromBY < toTY) {
      const detour = detourRoutes.get(relIndex)
      if (detour) {
        const trunkTop = detour.exitY + 1
        const trunkBottom = detour.entryY
        if (trunkBottom >= trunkTop) {
          // Vertical trunk has room — it's the longest segment of the
          // route in the common case, so anchor there. The label sits
          // flush against the trunk on its clear side (see doc comment)
          // rather than centered on it, with a 1-column gap for legibility.
          const gap = 1
          const idealMidX =
            detour.clearSide === 'right'
              ? detour.routeX + gap + Math.floor(labelWidth / 2)
              : detour.routeX - gap - Math.ceil(labelWidth / 2)
          return {
            idealMidX,
            baseMidY: Math.floor((trunkTop + trunkBottom) / 2),
          }
        }
        // Boxes are close enough together that the trunk has no vertical
        // room (exit and entry jogs sit on the same or adjacent rows) —
        // anchor on whichever horizontal jog is longer instead.
        const exitWidth = Math.abs(detour.routeX - detour.fromAnchorX)
        const entryWidth = Math.abs(detour.toAnchorX - detour.routeX)
        return entryWidth >= exitWidth
          ? {
              idealMidX: Math.floor((detour.routeX + detour.toAnchorX) / 2),
              baseMidY: detour.entryY,
            }
          : {
              idealMidX: Math.floor((detour.fromAnchorX + detour.routeX) / 2),
              baseMidY: detour.exitY,
            }
      }
      // A single-line label on a route with a horizontal run (`fromCX !==
      // toCX`) must not sit on that run's row (midY): it would overwrite the
      // run and leave the arrowhead detached from its stem (issue #2024).
      // Put it on the source's own stem (the rows between the source box and
      // the run), so it sits on the path like mermaid's edge labels and the
      // run keeps its arrowhead connection. With no stem row, fall back to
      // the row below the run, beside the target stem on the side facing the
      // source, when that row is free of the target's jog.
      const midY = fromBY + Math.floor((toTY - fromBY) / 2)
      // Only when no other relationship's lane falls inside the label's span:
      // a crowded stem would clip the label against its neighbour's territory.
      const half = Math.ceil(labelWidth / 2)
      const stemIsClear = diagram.relationships.every((other, i) => {
        const a = placed.get(other.from)
        const b = placed.get(other.to)
        if (i === relIndex || !a || !b) return true
        const c = connectionColumns(i, a, b)
        return [c.fromCX, c.toCX].every(
          (x) => x < fromCX - half || x > fromCX + half,
        )
      })
      if (
        lineCount === 1 &&
        fromCX !== toCX &&
        midY - 1 >= fromBY + 1 &&
        stemIsClear
      ) {
        return { idealMidX: fromCX, baseMidY: midY - 1 }
      }
      const lastRow = toTY - (toCX !== toAnchorX ? 2 : 1)
      if (lineCount === 1 && fromCX !== toCX && midY + 1 <= lastRow) {
        const idealMidX =
          toCX > fromCX
            ? toCX - Math.ceil(labelWidth / 2)
            : toCX + 1 + Math.floor(labelWidth / 2)
        if (idealMidX - Math.floor(labelWidth / 2) >= 0) {
          return { idealMidX, baseMidY: midY + 1 }
        }
      }
      return {
        idealMidX: Math.floor((fromCX + toCX) / 2),
        baseMidY: Math.floor((fromBY + 1 + toTY - 1) / 2),
      }
    }
    if (toP.y + toP.height - 1 < fromP.y) {
      const toBY = toP.y + toP.height - 1
      return {
        idealMidX: Math.floor((fromCX + toCX) / 2),
        baseMidY: Math.floor((toBY + 1 + fromP.y - 1) / 2),
      }
    }
    // Same level — anchor on the obstruction-aware detour row the connector
    // itself was routed through (see `sameLevelDetourY` above), not the
    // naive `Math.max(fromBY, toBY) + 2` recomputation, which ignores any
    // taller same-row box between `fromP`/`toP` and would place the label
    // right back inside it (issue #953).
    return {
      idealMidX: Math.floor((fromCX + toCX) / 2),
      // The `??` fallback is unreachable in practice: the main
      // relationship-drawing pass above runs for every relationship before
      // this label pass does, and it sets `sameLevelDetourY` for every
      // relIndex that takes this same "same level" branch — the exact
      // condition this function just evaluated to reach here. Kept only
      // because `Map.get` is typed `T | undefined`, not because a real
      // diagram can actually hit it.
      /* v8 ignore next */
      baseMidY:
        sameLevelDetourY.get(relIndex) ??
        Math.max(fromBY, toP.y + toP.height - 1) + 2,
    }
  }

  /**
   * Resolve a label's actual drawn row, starting from `computeLabelAnchor`'s
   * `baseMidY` and nudging it to the nearest box-free row in the from/to gap
   * when the ideal row would land inside an intervening box. Shared by the
   * territory precompute below and the draw pass further down so both agree
   * on the *same* final row for a given relationship — see the doc comment
   * on the territory precompute for why that agreement matters (issue #531).
   */
  function resolveLabelFinalY(
    fromP: PlacedClass,
    toP: PlacedClass,
    idealMidX: number,
    baseMidY: number,
    maxLabelWidth: number,
    lineCount: number,
    excludeIds: Set<string>,
  ): number {
    let labelY = baseMidY
    const halfHeight = Math.floor(lineCount / 2)
    const fromBY = fromP.y + fromP.height - 1
    const toTY = toP.y

    // Check if any label line would be inside a box
    let labelInBox = false
    for (let i = 0; i < lineCount; i++) {
      const y = labelY - halfHeight + i
      const idealLabelStart = idealMidX - Math.floor(maxLabelWidth / 2)
      const labelStart = Math.max(0, idealLabelStart)
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

    return labelY
  }

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
  //
  // rowStart/rowEnd are derived from `resolveLabelFinalY`'s result, *not*
  // `computeLabelAnchor`'s raw `baseMidY` — the same "clear box gap" runtime
  // fallback the draw pass applies can move a label to a row far from its
  // ideal one (e.g. a detoured relationship whose ideal row lands inside the
  // box it detoured around). Territories computed from the pre-fallback row
  // used to miss exactly the overlaps that fallback creates: two
  // relationships whose *ideal* rows didn't overlap could still both
  // resolve to the *same actual* row, and with no territory split between
  // them the later one's unconditional draw silently overwrote the earlier
  // one's label (issue #531). Resolving here, once, up front — and reusing
  // the result in the draw pass below via `finalLabelYByRel` — guarantees
  // territory and drawing always agree on the same row per relationship.
  //
  // The allocation itself — splitting contested columns at the midpoint
  // between two competing labels' idealMidX values — lives in
  // `allocateTerritory` (`territory.ts`), which is storage-agnostic and
  // knows nothing about relationships; this pass only supplies the geometry
  // (issue #618). Its doc comments carry the full rationale summarised
  // above.
  interface LabelGeometry {
    rel: (typeof diagram.relationships)[number]
    idealMidX: number
    naturalStart: number
    naturalEnd: number
    rowStart: number
    rowEnd: number
  }
  const finalLabelYByRel = new Map<
    (typeof diagram.relationships)[number],
    number
  >()
  const labelGeometry: LabelGeometry[] = []
  for (const [relIndex, rel] of diagram.relationships.entries()) {
    if (!rel.label) continue
    const fromP = placed.get(rel.from)
    const toP = placed.get(rel.to)
    if (!fromP || !toP) continue

    // Same anchor the draw pass below uses — needed so territory splitting
    // only ever kicks in between labels that could actually land on
    // overlapping rows. Two relationships can share a similar idealMidX
    // while being drawn many rows apart (e.g. one class's two separate
    // outgoing edges to two different targets at different heights) —
    // splitting their X territory in that case truncates both for no
    // reason, since they never actually collide.
    const lines = splitLines(rel.label)
    const halfHeight = Math.floor(lines.length / 2)

    const width = Math.max(...lines.map(displayWidth)) + 2 // +2 for padding
    const { idealMidX, baseMidY } = computeLabelAnchor(
      relIndex,
      fromP,
      toP,
      width,
      lines.length,
    )
    const excludeIds = new Set([rel.from, rel.to])
    const labelY = resolveLabelFinalY(
      fromP,
      toP,
      idealMidX,
      baseMidY,
      width,
      lines.length,
      excludeIds,
    )
    finalLabelYByRel.set(rel, labelY)
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
      rowStart: labelY - halfHeight,
      rowEnd: labelY + halfHeight,
    })
  }
  const territoryByGeometry = allocateTerritory(labelGeometry, (g) => ({
    idealMid: g.idealMidX,
    start: g.naturalStart,
    end: g.naturalEnd,
    rowStart: g.rowStart,
    rowEnd: g.rowEnd,
  }))
  const territoryByRel = new Map<
    (typeof diagram.relationships)[number],
    Territory
  >()
  for (const g of labelGeometry) {
    const territory = territoryByGeometry.get(g)
    if (territory) territoryByRel.set(g.rel, territory)
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
  const labelRects: LabelRect[] = []
  for (const [relIndex, rel] of diagram.relationships.entries()) {
    const fromP = placed.get(rel.from)
    const toP = placed.get(rel.to)
    if (!fromP || !toP) continue
    if (!rel.label) continue

    // Draw relationship label at midpoint (supports multi-line)
    // Add padding around the label for readability
    {
      const lines = splitLines(rel.label)
      const maxLabelWidth = Math.max(...lines.map((l) => displayWidth(l))) + 2 // +2 for padding

      // Calculate ideal label position based on routing direction (and, for
      // a detoured relationship, its actual routed path — see
      // `computeLabelAnchor`).
      const { idealMidX } = computeLabelAnchor(
        relIndex,
        fromP,
        toP,
        maxLabelWidth,
        lines.length,
      )

      // The row to draw on: resolved once, up front, by the territory
      // precompute above (via `resolveLabelFinalY`) — reused here rather
      // than re-resolved so this pass and the territory it reads from
      // (`territoryByRel`, just below) always agree on the same row for
      // this relationship. See the precompute's doc comment (issue #531).
      const labelY = finalLabelYByRel.get(rel)!
      const halfHeight = Math.floor(lines.length / 2)

      // Center lines vertically around labelY
      const startY = labelY - halfHeight

      const territory = territoryByRel.get(rel)!
      const rect: LabelRect = { x0: Infinity, y0: startY, x1: -1, y1: startY }

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const y = startY + lineIdx
        const text = lines[lineIdx]!

        // Grid cells, not code units: a wide glyph occupies two columns, so
        // measuring/writing by code unit would centre the label wrong and
        // overrun the space cleared for it.
        const naturalCells = toDisplayCells(` ${text} `) // Space padding on both sides
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
            rect.x0 = Math.min(rect.x0, lx)
            rect.x1 = Math.max(rect.x1, lx)
            rect.y1 = Math.max(rect.y1, y)
          }
        }
      }
      if (lines.length > 1 && rect.x1 >= 0) labelRects.push(rect)
    }
  }

  // --- Draw relationship cardinalities (issue #2114) ---
  // Each cardinality sits beside the line next to its own end: on the row
  // hugging the box (where the marker is), to the right of the line like
  // mermaid, otherwise to the left, otherwise one row further along the line.
  // Drawn after the lines and labels and only into blank cells, so it can
  // never overwrite a marker, a border, a label or another line. The rows
  // are nearest-first and stop short of the line's middle, so a cardinality
  // never reads as belonging to the other end. If nothing is free (a very
  // crowded fan), the cardinality is left out rather than drawn over
  // something else.
  const CARDINALITY_ROWS = 2
  // Columns the diagram would need to move right for a cardinality that fits
  // nowhere else but off the left edge.
  let cardinalityNeedsLeft = 0
  const isFree = (x: number, y: number): boolean =>
    x < 0 ||
    y < 0 ||
    (!boxCells.has(`${x},${y}`) && (canvas[x]?.[y] ?? ' ') === ' ')
  for (const [relIndex, rel] of diagram.relationships.entries()) {
    const ends = relEnds.get(relIndex)
    if (!ends) continue
    for (const [raw, end] of [
      [rel.fromCardinality, ends.from],
      [rel.toCardinality, ends.to],
    ] as const) {
      if (!raw) continue
      const cells = toDisplayCells(raw.replace(/\s*\n\s*/g, ' '))
      const w = cells.length
      let spot: { x: number; y: number } | undefined
      for (let k = 0; k < CARDINALITY_ROWS && !spot; k++) {
        const y = end.y + end.dy * k
        // Right of the line, then left; one blank column kept around the text.
        for (const x0 of [
          end.x + 1 + CARDINALITY_GAP,
          end.x - CARDINALITY_GAP - w,
        ]) {
          if (x0 < 0) continue
          let free = true
          for (let x = x0 - 1; x <= x0 + w && free; x++) {
            free = isFree(x, y)
          }
          if (free) {
            spot = { x: x0, y }
            break
          }
        }
      }
      if (!spot) {
        // Right of the line was blocked: the left side is the way out, if the
        // canvas edge allows it.
        cardinalityNeedsLeft = Math.max(
          cardinalityNeedsLeft,
          CARDINALITY_GAP + w - end.x,
        )
        continue
      }
      increaseSize(canvas, spot.x + w + 1, spot.y + 1)
      increaseRoleCanvasSize(rc, spot.x + w + 1, spot.y + 1)
      for (const [i, cell] of cells.entries()) {
        setC(spot.x + i, spot.y, cell, 'text')
      }
    }
  }

  // A cardinality had room nowhere but off the left edge: lay out again with
  // the diagram moved right by that much (at most once).
  if (cardinalityNeedsLeft > 0 && cardinalityLeftPad === 0) {
    return renderClassAscii(
      text,
      config,
      colorMode,
      theme,
      options,
      detourRoomLevels,
      cardinalityNeedsLeft,
    )
  }

  // --- Draw namespace frames ---
  // Drawn last, into blank cells only: a relationship that crosses a frame
  // keeps its stroke (the frame border yields), and the title slides along
  // the top border (widening the frame if it must) to stay clear of strokes.
  for (const r of frameRects) {
    const h = useAscii ? '-' : '─'
    const v = useAscii ? '|' : '│'
    const c = useAscii
      ? { tl: '+', tr: '+', bl: '+', br: '+' }
      : { tl: '┌', tr: '┐', bl: '└', br: '┘' }
    const cells = toDisplayCells(` ${r.name} `)
    const titleY = bottomUp ? r.y1 : r.y0
    // Columns past the current canvas edge count as blank.
    const blank = (x: number): boolean =>
      !canvas[x] || canvas[x][titleY] === ' '
    // Leftmost start, one dash in from the corner, whose cells plus a dash
    // each side hold no stroke.
    let start = r.x0 + 2
    while (
      Array.from({ length: cells.length + 2 }, (_, i) => start - 1 + i).some(
        (x) => !blank(x),
      )
    ) {
      start++
    }
    r.x1 = Math.max(r.x1, start + cells.length + 1)
    increaseSize(canvas, r.x1 + 1, r.y1 + 1)
    increaseRoleCanvasSize(rc, r.x1 + 1, r.y1 + 1)

    const put = (x: number, y: number, ch: string, role: CharRole): void => {
      if (canvas[x]?.[y] === ' ') setC(x, y, ch, role)
    }
    for (let x = r.x0 + 1; x < r.x1; x++) {
      put(x, r.y0, h, 'border')
      put(x, r.y1, h, 'border')
    }
    for (let y = r.y0 + 1; y < r.y1; y++) {
      put(r.x0, y, v, 'border')
      put(r.x1, y, v, 'border')
    }
    put(r.x0, r.y0, c.tl, 'border')
    put(r.x1, r.y0, c.tr, 'border')
    put(r.x0, r.y1, c.bl, 'border')
    put(r.x1, r.y1, c.br, 'border')
    // The loop above left these cells blank, so the border pass wrote dashes there.
    for (const [i, cell] of cells.entries()) {
      setC(start + i, titleY, cell, 'text')
    }
  }

  // Notes were drawn as plain boxes above; round their corners and join
  // each attached note to its class. Last, so a connector never lands on
  // top of a relationship line or label.
  decorateAsciiNotes(notesById, placed, canvas, useAscii, setC)

  if (bottomUp) {
    flipClassCanvas(
      canvas,
      rc,
      linkCanvas,
      [...placed.values()].filter((p) => !lollipops.has(p.cls.id)),
      labelRects,
    )
  }

  return canvasToString(canvas, {
    roleCanvas: rc,
    colorMode,
    theme,
    linkCanvas,
  })
}

// ============================================================================
// Notes — `note "text"` / `note for X "text"` (issue #420)
//
// A note is laid out as a pseudo-class: it gets a box like any class (a
// single header-only section holding the note text, via the same
// buildClassSections/drawMultiBox path), and is spliced into
// `diagram.classes` immediately after the class it annotates so the row
// placement puts it directly to that class's right. A free note, or one
// whose class doesn't exist, is appended to the end and sits on the top row.
// After all boxes and relationships are drawn, decorateAsciiNotes() swaps
// the note's corners for rounded ones — the same rectangle-vs-rounded
// distinction the flowchart ASCII renderer draws — and joins an attached
// note to its class with a short dashed connector, the ASCII counterpart of
// the dotted note→class link Mermaid draws. Class ids can't contain
// whitespace, so a pseudo id with a space in it can never collide with one.
// ============================================================================

/**
 * Return a copy of `parsed` whose `classes` list also contains one
 * pseudo-class per note, positioned as described above, plus a map from each
 * pseudo id to its note.
 */
function withNotePseudoClasses(parsed: ClassDiagram): {
  diagram: ClassDiagram
  notesById: Map<string, ClassNote>
} {
  const notesById = new Map<string, ClassNote>()
  if (parsed.notes.length === 0) return { diagram: parsed, notesById }

  const pseudo = (index: number, note: ClassNote): ClassNode => {
    const id = `note ${index}`
    notesById.set(id, note)
    return { id, label: note.text, attributes: [], methods: [] }
  }

  const classIds = new Set(parsed.classes.map((c) => c.id))
  const classes: ClassNode[] = []
  for (const cls of parsed.classes) {
    classes.push(cls)
    for (const [i, note] of parsed.notes.entries()) {
      if (note.forClass === cls.id) classes.push(pseudo(i, note))
    }
  }
  for (const [i, note] of parsed.notes.entries()) {
    if (note.forClass === undefined || !classIds.has(note.forClass)) {
      classes.push(pseudo(i, note))
    }
  }

  return { diagram: { ...parsed, classes }, notesById }
}

/**
 * Put each attached note on the same level as its class. In BT mermaid puts
 * it one rank toward the roots instead (below the class once flipped), so a
 * non-root class's note moves up one level here.
 */
function pinNoteLevels(
  notesById: Map<string, ClassNote>,
  level: Map<string, number>,
  bottomUp: boolean,
): void {
  for (const [id, note] of notesById) {
    if (note.forClass === undefined) continue
    const classLevel = level.get(note.forClass)
    if (classLevel === undefined) continue
    level.set(id, bottomUp && classLevel > 0 ? classLevel - 1 : classLevel)
  }
}

/**
 * Round each note box's corners and draw the dashed connector from an
 * attached note's class to the note. The connector only fills cells that
 * are still blank, so it can never break a relationship line that happens
 * to route through the gap.
 */
function decorateAsciiNotes(
  notesById: Map<string, ClassNote>,
  placed: Map<string, PlacedClass>,
  canvas: Canvas,
  useAscii: boolean,
  setC: (x: number, y: number, ch: string, role: CharRole) => void,
): void {
  if (notesById.size === 0) return
  const corners = getCorners('rounded', useAscii)
  const dash = useAscii ? '.' : '╌'

  for (const [id, note] of notesById) {
    const p = placed.get(id)
    if (!p) continue
    const right = p.x + p.width - 1
    const bottom = p.y + p.height - 1
    setC(p.x, p.y, corners.tl, 'border')
    setC(right, p.y, corners.tr, 'border')
    setC(p.x, bottom, corners.bl, 'border')
    setC(right, bottom, corners.br, 'border')

    if (note.forClass === undefined) continue
    const cls = placed.get(note.forClass)
    // By construction the note sits directly right of its class on the same
    // row; anything else means the layout changed under us — skip the line
    // rather than draw one through the middle of the diagram.
    if (!cls) continue
    if (cls.y >= p.y + p.height && cls.x + cls.width <= p.x) {
      // BT: the note sits on an earlier level, up and to the right of its
      // class. Run the link out of the class's right side, then along the
      // note's centre column up to the note; leave it out if another box is
      // in that path.
      const x0 = cls.x + cls.width
      const x = p.x + (p.width >> 1)
      const y = cls.y + 1
      const up = useAscii ? ':' : '┊'
      const top = p.y + p.height
      // The link is the row segment x0..x at y plus the column segment top..y
      // at x; only a box on one of those segments is in the way.
      const hits = (
        o: PlacedClass,
        xa: number,
        xb: number,
        ya: number,
        yb: number,
      ) => o.x <= xb && o.x + o.width > xa && o.y <= yb && o.y + o.height > ya
      if (
        [...placed.values()].some(
          (o) =>
            o !== p &&
            o !== cls &&
            (hits(o, x0, x, y, y) || hits(o, x, x, top, y)),
        )
      )
        continue
      for (let cx = x0; cx < x; cx++) {
        if (canvas[cx]?.[y] === ' ') setC(cx, y, dash, 'line')
      }
      for (let cy = top; cy < y; cy++) {
        if (canvas[x]?.[cy] === ' ') setC(x, cy, up, 'line')
      }
      // Drawn top-down, the corner flips to ╮ with the rest of the canvas.
      setC(x, y, useAscii ? up : '╯', 'line')
      continue
    }
    if (cls.x + cls.width > p.x || cls.y !== p.y) continue
    const y = cls.y + 1
    for (let x = cls.x + cls.width; x < p.x; x++) {
      if (canvas[x]?.[y] === ' ') setC(x, y, dash, 'line')
    }
  }
}

// ============================================================================
// Lollipop interfaces
//
// Mermaid draws `A ()-- B` as the name `A` above a small circle, joined to
// `B` by a stem, with no edge to a class `A` (and no `A` box at all when `A`
// is used only this way). Same here: each lollipop's interface end becomes a
// one-row, box-less pseudo-class (id has a space, so it can't collide with a
// class id) that the normal layout and edge routing treat like any class, so
// `from` lands above `to`. The edge's circle marker is the lollipop. `()--()`
// has no single host and stays an ordinary relationship.
// ============================================================================

export interface AsciiLollipop {
  host: string
}

function withLollipopPseudoClasses(parsed: ClassDiagram): {
  diagram: ClassDiagram
  lollipops: Map<string, AsciiLollipop>
} {
  const lollipops = new Map<string, AsciiLollipop>()
  const relationships: ClassRelationship[] = []
  const interfaceIds = new Set<string>()
  const pseudo: ClassNode[] = []
  for (const rel of parsed.relationships) {
    if (rel.type !== 'lollipop' || rel.markerAt === 'both') {
      relationships.push(rel)
      continue
    }
    const left = rel.markerAt === 'from'
    const host = left ? rel.to : rel.from
    const name = left ? rel.from : rel.to
    const id = `lollipop ${lollipops.size}`
    lollipops.set(id, { host })
    interfaceIds.add(name)
    pseudo.push({ id, label: name, attributes: [], methods: [] })
    relationships.push(left ? { ...rel, from: id } : { ...rel, to: id })
  }
  if (lollipops.size === 0) return { diagram: parsed, lollipops }

  // An interface keeps its box only when something else gives it one.
  const kept = new Set(
    relationships
      .filter((r) => r.type !== 'lollipop' || r.markerAt === 'both')
      .flatMap((r) => [r.from, r.to]),
  )
  for (const { host } of lollipops.values()) kept.add(host)
  for (const note of parsed.notes) if (note.forClass) kept.add(note.forClass)
  for (const ns of parsed.namespaces) for (const id of ns.classIds) kept.add(id)
  const drop = (c: ClassNode): boolean =>
    interfaceIds.has(c.id) &&
    !kept.has(c.id) &&
    !c.annotation &&
    c.attributes.length === 0 &&
    c.methods.length === 0

  // Pseudo-classes go last, in source order: mermaid lays real classes out
  // first and hangs each interface name off its host afterwards.
  const classes = [...parsed.classes.filter((c) => !drop(c)), ...pseudo]
  return { diagram: { ...parsed, classes, relationships }, lollipops }
}

// ============================================================================
// BT: the top-down drawing, flipped
//
// Flipping the whole canvas turns each box's border rows into valid borders
// of the mirrored box (`└──┬──┘` becomes `┌──┴──┐`), but would also put its
// compartments upside down, so the interior rows are put back as drawn. (A
// namespace frame's title is drawn on the bottom border for BT, so the flip
// lands it on the top one.)
// ============================================================================

function flipClassCanvas(
  canvas: Canvas,
  rc: RoleCanvas,
  linkCanvas: LinkCanvas | undefined,
  boxes: PlacedClass[],
  labelRects: LabelRect[],
): void {
  const H = canvas[0]!.length
  // Interior rows of every box (between the two border rows), as drawn.
  const saved = boxes.map((b) => {
    const cols: { ch: string; role: CharRole | null; link: string | null }[][] =
      []
    for (let x = b.x; x < b.x + b.width; x++) {
      const col = []
      for (let y = b.y + 1; y < b.y + b.height - 1; y++) {
        col.push({
          ch: canvas[x]![y]!,
          role: rc[x]![y] ?? null,
          link: linkCanvas?.[x]?.[y] ?? null,
        })
      }
      cols.push(col)
    }
    return cols
  })

  mirrorLabelRows(canvas, rc, labelRects, linkCanvas)
  flipCanvasVertically(canvas, rc)
  flipRoleCanvasVertically(rc)
  if (linkCanvas) flipLinkCanvasVertically(linkCanvas)

  for (const [i, b] of boxes.entries()) {
    const top = H - 1 - (b.y + b.height - 1)
    for (const [cx, col] of saved[i]!.entries()) {
      for (const [j, cell] of col.entries()) {
        canvas[b.x + cx]![top + 1 + j] = cell.ch
        rc[b.x + cx]![top + 1 + j] = cell.role as CharRole
        if (linkCanvas) linkCanvas[b.x + cx]![top + 1 + j] = cell.link
      }
    }
  }
}
