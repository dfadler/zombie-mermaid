// ============================================================================
// Event modeling types
//
// The parsed model of a Mermaid `eventmodeling` diagram, plus the positioned
// model the SVG renderer draws (`PositionedEventModeling`, produced by
// `layoutEventModeling` in `@zombie-mermaid/svg-renderer`). The ASCII renderer
// works from the parsed `EventModeling` directly.
// ============================================================================

/** The five entity kinds (`ui`, `pcr`/`processor`, `cmd`/`command`, `rmo`/`readmodel`, `evt`/`event`). */
export type EventModelingEntityType =
  | 'ui'
  | 'processor'
  | 'command'
  | 'readmodel'
  | 'event'

/** One time frame (`tf` / `timeframe`) or reset frame (`rf` / `resetframe`). */
export interface EventModelingFrame {
  /** The frame number as written (`'01'`): its identity, unique in the diagram. */
  id: string
  /** A reset frame draws no implicit relation from the frame before it. */
  reset: boolean
  entityType: EventModelingEntityType
  /** The identifier as written, `Namespace.Name` or `Name`. */
  identifier: string
  /** The part before the first `.` of a two-part identifier: it opens a swimlane of its own. */
  namespace?: string
  /** The drawn name (the part after the `.`). */
  name: string
  /** Ids of the frames written after `->>` that exist, in order (unknown ids are ignored, as Mermaid does). */
  sources: string[]
  /** Inline data as written, including its braces or quotes. */
  dataInline?: string
  /** `[[Name]]`, the data block this frame points at. */
  dataRef?: string
}

/** A `data Name { ... }` block, referenced from a frame with `[[Name]]`. */
export interface EventModelingDataBlock {
  name: string
  /** The block as written, braces included. */
  value: string
}

/** A parsed Mermaid event modeling diagram. */
export interface EventModeling {
  frames: EventModelingFrame[]
  dataBlocks: EventModelingDataBlock[]
}

/** A swimlane: a band over the whole timeline holding the frames of one entity group. */
export interface PositionedEventModelingLane {
  /** Sort key: 0-99 UI/processor lanes, 100-199 command/read model, 200-299 events. */
  index: number
  label: string
  y: number
  height: number
}

/** A frame, ready to draw. */
export interface PositionedEventModelingBox {
  frame: EventModelingFrame
  x: number
  y: number
  width: number
  height: number
  /** Index into `PositionedEventModeling.lanes`. */
  lane: number
  /** The bold name (wrapped) then the data lines, centred as a block. */
  nameLines: string[]
  dataLines: string[]
}

/** An arrow from one box to another. */
export interface PositionedEventModelingRelation {
  x1: number
  y1: number
  x2: number
  y2: number
  /** Index into `boxes`. */
  from: number
  to: number
}

/** A diagram ready to draw, in Mermaid's own coordinates (see `viewBox`). */
export interface PositionedEventModeling {
  viewBox: { x: number; y: number; width: number; height: number }
  lanes: PositionedEventModelingLane[]
  /** Width of every lane band. */
  laneWidth: number
  boxes: PositionedEventModelingBox[]
  relations: PositionedEventModelingRelation[]
}
