// ============================================================================
// ASCII renderer — class diagrams laid out left-to-right / right-to-left
//
// `renderClassAscii` (class-diagram.ts) is a level-row layout: levels are
// stacked rows, so it can draw TB and (flipped) BT but has no notion of a
// column. For `direction LR` / `RL` the diagram is lowered onto the flowchart
// model instead, as architecture diagrams are: each class becomes a node,
// each relationship an edge, each namespace a subgraph, and the flowchart
// grid layout, lane routing and RL mirroring do the placement. Only what is
// class-specific stays here: the compartment box, the UML end markers and the
// cardinalities (see docs/decisions/ for the choice).
// ============================================================================

import type {
  ClassDiagram,
  ClassNote,
  ClassRelationship,
} from '@zombie-mermaid/mermaid-parser'
import type {
  MermaidEdge,
  MermaidGraph,
  MermaidNode,
  MermaidSubgraph,
} from '@zombie-mermaid/core'
import type { AsciiLollipop, AsciiNamespaceFrame } from './class-diagram.ts'
import { buildClassSections } from './class-sections.ts'
import { DEFAULT_ASCII_THEME } from './ansi.ts'
import { renderGraphAscii } from './flowchart.ts'
import { encodeSections } from './shapes/class-box.ts'
import {
  Left,
  Right,
  DEFAULT_PADDING_Y,
  dirEquals,
  paddingOffset,
} from './types.ts'
import { write } from './canvas.ts'
import { toDisplayCells } from './display-width.ts'
import type {
  AsciiConfig,
  AsciiEdgeMarker,
  AsciiGraph,
  AsciiNode,
  AsciiTheme,
  ClassNodeShape,
  ColorMode,
} from './types.ts'

/** The `direction` values this module draws; TB and BT stay in class-diagram.ts. */
export function isSideways(direction: string | undefined): boolean {
  return direction === 'LR' || direction === 'RL'
}

const MARKER_OF: Record<ClassRelationship['type'], AsciiEdgeMarker> = {
  inheritance: 'class-triangle',
  realization: 'class-triangle',
  composition: 'class-diamond-filled',
  aggregation: 'class-diamond',
  association: 'class-arrow',
  dependency: 'class-arrow',
  lollipop: 'class-circle',
}

/** Render a class diagram whose `direction` is LR or RL. */
/** A diagram after `renderClassAscii` has parsed it and split off its pseudo-classes. */
export interface PreparedClassDiagram {
  diagram: ClassDiagram
  lollipops: Map<string, AsciiLollipop>
  notesById: Map<string, ClassNote>
  frames: AsciiNamespaceFrame[]
}

/** Render a class diagram whose `direction` is LR or RL. */
export function renderClassFlowAscii(
  { diagram, lollipops, notesById, frames }: PreparedClassDiagram,
  config: AsciiConfig,
  colorMode: ColorMode = 'none',
  theme: AsciiTheme = DEFAULT_ASCII_THEME,
  options: { hyperlinks?: boolean } = {},
): string {
  const nodes = new Map<string, MermaidNode>()
  const kindOf = new Map<string, { shape: ClassNodeShape; label: string }>()
  for (const cls of diagram.classes) {
    nodes.set(cls.id, { id: cls.id, label: cls.label, shape: 'rectangle' })
    const note = notesById.get(cls.id)
    if (note) {
      kindOf.set(cls.id, {
        shape: 'class-note',
        label: encodeSections([note.text.split('\n')]),
      })
    } else if (lollipops.has(cls.id)) {
      kindOf.set(cls.id, { shape: 'class-name', label: cls.label })
    } else {
      kindOf.set(cls.id, {
        shape: 'class-box',
        label: encodeSections(buildClassSections(cls)),
      })
    }
  }

  const edges: MermaidEdge[] = []
  const markers: { start?: AsciiEdgeMarker; end?: AsciiEdgeMarker }[] = []
  const cardinalities: { edge: number; start?: string; end?: string }[] = []
  for (const rel of diagram.relationships) {
    if (rel.fromCardinality || rel.toCardinality) {
      cardinalities.push({
        edge: edges.length,
        ...(rel.fromCardinality ? { start: rel.fromCardinality } : {}),
        ...(rel.toCardinality ? { end: rel.toCardinality } : {}),
      })
    }
    const marker = MARKER_OF[rel.type]
    const start = rel.markerAt !== 'to'
    const end = rel.markerAt !== 'from'
    edges.push({
      source: rel.from,
      target: rel.to,
      ...(rel.label ? { label: rel.label } : {}),
      style:
        rel.type === 'dependency' || rel.type === 'realization'
          ? 'dotted'
          : 'solid',
      hasArrowStart: start,
      hasArrowEnd: end,
    })
    markers.push({
      ...(start ? { start: marker } : {}),
      ...(end ? { end: marker } : {}),
    })
  }
  // A note hangs off its class by a dotted, arrowless link; the note is the
  // source, so it lands before the class on the flow axis (left in LR).
  for (const [id, note] of notesById) {
    if (note.forClass === undefined || !nodes.has(note.forClass)) continue
    edges.push({
      source: id,
      target: note.forClass,
      style: 'dotted',
      hasArrowStart: false,
      hasArrowEnd: false,
    })
    markers.push({})
  }

  const subgraphs: MermaidSubgraph[] = frames.map((fr, i) => ({
    id: `namespace ${i}`,
    label: fr.name,
    nodeIds: fr.ids,
    children: [],
  }))

  const graph: MermaidGraph = {
    direction: diagram.direction === 'RL' ? 'RL' : 'LR',
    nodes,
    edges,
    subgraphs,
    classDefs: new Map(),
    classAssignments: new Map(),
    nodeStyles: new Map(),
    linkStyles: new Map(),
    interactions: options.hyperlinks ? diagram.interactions : new Map(),
  }

  const afterDraw = (g: AsciiGraph): void => {
    joinDividers(g)
    repairCrossings(g)
    placeCardinalities(g, cardinalities)
  }

  const afterConvert = (g: AsciiGraph): void => {
    for (const node of g.nodes) {
      const k = kindOf.get(node.name)
      if (!k) continue
      node.shape = k.shape
      node.displayLabel = k.label
      if (k.shape === 'class-name') {
        // Hug the circle: on the side facing it as drawn, which a later RL
        // mirror turns around (a label keeps its place in its own rectangle).
        const source = diagram.relationships.some(
          (r) => lollipops.has(r.from) && r.from === node.name,
        )
        node.textAlign = source !== (graph.direction === 'RL') ? 'end' : 'start'
      }
    }
    for (const [i, edge] of g.edges.entries()) {
      const m = markers[i]
      if (m?.start) edge.startMarker = m.start
      if (m?.end) edge.endMarker = m.end
      edge.sideFaces = true
    }
  }

  const linkRows = (node: AsciiNode) => {
    const cls = diagram.classes.find((c) => c.id === node.name)
    if (!cls || node.shape !== 'class-box') return undefined
    // The class name line(s) of the header, as the top-down drawing links.
    return {
      from: 1 + (cls.annotation ? 1 : 0),
      to: buildClassSections(cls)[0]!.length,
    }
  }

  // Stacked siblings sit one row closer than the flowchart default; fewer
  // rows leave a self-loop too little room under its box for the head and the
  // corner row.
  return renderGraphAscii(
    graph,
    {
      ...config,
      paddingY: paddingOffset(config.paddingY, DEFAULT_PADDING_Y, 4, 1),
    },
    colorMode,
    theme,
    { hyperlinks: options.hyperlinks },
    { afterConvert, afterDraw, linkRows },
  )
}

// ============================================================================
// Cardinalities
//
// Each sits beside the line next to its own end, on the stroke cell the end
// marker uses: above the line at the source and below it at the target for a
// horizontal run (as mermaid sets them), one blank column off a vertical one.
// A spot is taken only if every cell of it is still blank; there is no room
// reserved for them, so the first of the candidates that fits wins.
// ============================================================================

function placeCardinalities(
  graph: AsciiGraph,
  cards: { edge: number; start?: string; end?: string }[],
): void {
  const canvas = graph.canvas
  const blank = (x: number, y: number): boolean => canvas[x]?.[y] === ' '
  for (const { edge: index, start, end } of cards) {
    const ends = graph.edges[index]?.ends
    if (!ends) continue
    for (const [label, at, isStart] of [
      [start, ends.start, true],
      [end, ends.end, false],
    ] as const) {
      if (!label) continue
      const cells = toDisplayCells(label)
      const len = cells.length
      // Which way the line runs away from the box it labels.
      const flow = isStart ? at.dir : { x: 2 - at.dir.x, y: 2 - at.dir.y }
      const sideways = dirEquals(flow, Right) || dirEquals(flow, Left)
      const spots: { x: number; y: number }[] = []
      if (sideways) {
        const x0 = dirEquals(flow, Right) ? at.x : at.x - len + 1
        const rows = isStart ? [at.y - 1, at.y + 1] : [at.y + 1, at.y - 1]
        const shift = dirEquals(flow, Right) ? 1 : -1
        for (const dx of [0, shift, 2 * shift]) {
          for (const y of rows) spots.push({ x: x0 + dx, y })
        }
      } else {
        spots.push({ x: at.x + 2, y: at.y }, { x: at.x - 1 - len, y: at.y })
      }
      const spot = spots.find(({ x, y }) =>
        cells.every((_, i) => blank(x + i, y)),
      )
      if (!spot) continue
      for (const [i, cell] of cells.entries()) {
        write(canvas, spot.x + i, spot.y, cell, {
          role: 'text',
          roleCanvas: graph.roleCanvas,
        })
      }
      ;(graph.labelRects ??= []).push({
        x0: spot.x,
        x1: spot.x + len - 1,
        y0: spot.y,
        y1: spot.y,
      })
    }
  }
}

// ============================================================================
// Compartment dividers
//
// A line that reaches a box side on a divider row meets `├`/`┤`, which the
// flowchart's own connector only tees into a plain `│`. Make it the `┼` the
// two strokes form. (ASCII dividers are `+` already.) The strokes of a divider
// are border, not label text.
// ============================================================================

const HORIZONTAL_STROKES = new Set(['─', '┄', '━', '┅'])

function joinDividers(graph: AsciiGraph): void {
  const canvas = graph.canvas
  for (const node of graph.nodes) {
    if (node.shape !== 'class-box' || !node.drawing || !node.drawingCoord)
      continue
    const { x: ox, y: oy } = node.drawingCoord
    const last = node.drawing.length - 1
    for (let y = 1; y < node.drawing[0]!.length - 1; y++) {
      // The label rectangle covers every interior row, so a divider's strokes
      // were tagged as text; they are border.
      if (node.drawing[0]![y] === (graph.config.useAscii ? '+' : '├')) {
        for (let x = 1; x < last; x++)
          graph.roleCanvas[ox + x]![oy + y] = 'border'
      }
      const left = canvas[ox - 1]?.[oy + y]
      const right = canvas[ox + last + 1]?.[oy + y]
      if (
        node.drawing[0]![y] === '├' &&
        left !== undefined &&
        HORIZONTAL_STROKES.has(left)
      ) {
        canvas[ox]![oy + y] = '┼'
      }
      if (
        node.drawing[last]![y] === '┤' &&
        right !== undefined &&
        HORIZONTAL_STROKES.has(right)
      ) {
        canvas[ox + last]![oy + y] = '┼'
      }
    }
  }
}

// ============================================================================
// Crossings
//
// The flowchart router lets two lines cross where a lane runs beside a box's
// side, and draws the stroke it laid last straight over the other. A line
// stroke with a line running through it at right angles is a `┼`.
// ============================================================================

const CROSS_DOWN = new Set(['│', '┆', '┬', '┼', '├', '┤', '┌', '┐'])
const CROSS_UP = new Set(['│', '┆', '┴', '┼', '├', '┤', '└', '┘'])
const CROSS_RIGHT = new Set(['─', '┄', '┬', '┴', '┼', '├', '┌', '└'])
const CROSS_LEFT = new Set(['─', '┄', '┬', '┴', '┼', '┤', '┐', '┘'])

function repairCrossings(graph: AsciiGraph): void {
  if (graph.config.useAscii) return
  const { canvas, roleCanvas } = graph
  const at = (x: number, y: number) => canvas[x]?.[y] ?? ' '
  const fixes: [number, number][] = []
  for (const [x, col] of canvas.entries()) {
    for (const [y, ch] of col.entries()) {
      if (roleCanvas[x]?.[y] !== 'line') continue
      const horizontal = ch === '─' || ch === '┄'
      const vertical = ch === '│' || ch === '┆'
      if (
        (horizontal &&
          CROSS_DOWN.has(at(x, y - 1)) &&
          CROSS_UP.has(at(x, y + 1))) ||
        (vertical &&
          CROSS_RIGHT.has(at(x - 1, y)) &&
          CROSS_LEFT.has(at(x + 1, y)))
      ) {
        fixes.push([x, y])
      }
    }
  }
  for (const [x, y] of fixes) canvas[x]![y] = '┼'
}
