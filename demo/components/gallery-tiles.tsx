/** @jsxRuntime automatic */
/**
 * The twenty-one small animated SVG illustrations `DiagramGalleryTeaser`
 * (`diagram-gallery-teaser.tsx`) links to, one per diagram type — kept
 * together in one file since they're trivial variants of the same shape
 * (a `viewBox="0 0 100 70"` SVG, no props, one accent color each) rather
 * than warranting six near-empty files of their own.
 *
 * Split out of `index-app.tsx` into its own file (zombie-mermaid#932).
 */
import { colorVar } from './tokens.tsx'

/** Flowchart: two boxes joined by a drawn connector. */
export function FlowchartTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <rect
        x="6"
        y="8"
        width="34"
        height="18"
        rx="4"
        fill="none"
        stroke={colorVar('--blue')}
        strokeWidth="2"
      />
      <rect
        x="60"
        y="44"
        width="34"
        height="18"
        rx="4"
        fill="none"
        stroke={colorVar('--blue')}
        strokeWidth="2"
      />
      <path
        d="M23 26 V44 H77 V44"
        stroke={colorVar('--blue')}
        strokeWidth="2"
        fill="none"
        className="edge-anim"
      />
    </svg>
  )
}

/** State: two states, one pulsing (the "current" state radar ping). */
export function StateTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <circle
        cx="24"
        cy="20"
        r="14"
        fill="none"
        stroke={colorVar('--violet')}
        strokeWidth="2"
        className="radar-ping"
      />
      <circle
        cx="24"
        cy="20"
        r="14"
        fill="none"
        stroke={colorVar('--violet')}
        strokeWidth="2"
      />
      <circle
        cx="76"
        cy="50"
        r="14"
        fill="none"
        stroke={colorVar('--violet')}
        strokeWidth="2"
      />
      <path
        d="M36 28 L64 42"
        stroke={colorVar('--violet')}
        strokeWidth="2"
        fill="none"
      />
    </svg>
  )
}

/** Sequence: two lifelines exchanging messages in both directions. */
export function SequenceTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <line
        x1="22"
        y1="8"
        x2="22"
        y2="62"
        stroke={colorVar('--cyan')}
        strokeWidth="2"
      />
      <line
        x1="78"
        y1="8"
        x2="78"
        y2="62"
        stroke={colorVar('--cyan')}
        strokeWidth="2"
      />
      <path
        d="M22 24 H78"
        stroke={colorVar('--cyan')}
        strokeWidth="2"
        className="msg-flow-right"
      />
      <path
        d="M78 44 H22"
        stroke={colorVar('--cyan')}
        strokeWidth="2"
        className="msg-flow-left"
      />
    </svg>
  )
}

/** Class: a class box, its two member rows drawing themselves in. */
export function ClassTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <rect
        x="22"
        y="8"
        width="56"
        height="50"
        rx="3"
        fill="none"
        stroke={colorVar('--amber')}
        strokeWidth="2"
      />
      <line
        x1="22"
        y1="26"
        x2="78"
        y2="26"
        stroke={colorVar('--amber')}
        strokeWidth="2"
        className="draw-line"
      />
      <line
        x1="22"
        y1="42"
        x2="78"
        y2="42"
        stroke={colorVar('--amber')}
        strokeWidth="2"
        className="draw-line"
        style={{ animationDelay: '0.5s' }}
      />
    </svg>
  )
}

/** ER: two entities, a pulsing relationship diamond between them. */
export function ERTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <rect
        x="4"
        y="24"
        width="30"
        height="20"
        rx="3"
        fill="none"
        stroke={colorVar('--pink')}
        strokeWidth="2"
      />
      <rect
        x="66"
        y="24"
        width="30"
        height="20"
        rx="3"
        fill="none"
        stroke={colorVar('--pink')}
        strokeWidth="2"
      />
      <polygon
        points="50,20 60,34 50,48 40,34"
        fill="none"
        stroke={colorVar('--pink')}
        strokeWidth="2"
        className="relation-pulse"
      />
      <path
        d="M34 34 H40 M60 34 H66"
        stroke={colorVar('--pink')}
        strokeWidth="2"
        className="relation-pulse"
      />
    </svg>
  )
}

/** XY Chart: three bars growing, a trend line drawn across them. */
export function XYChartTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <line
        x1="10"
        y1="8"
        x2="10"
        y2="62"
        stroke={colorVar('--green')}
        strokeWidth="2"
      />
      <line
        x1="10"
        y1="62"
        x2="94"
        y2="62"
        stroke={colorVar('--green')}
        strokeWidth="2"
      />
      <rect
        x="20"
        y="40"
        width="10"
        height="22"
        fill={colorVar('--green')}
        className="bar-grow"
      />
      <rect
        x="38"
        y="28"
        width="10"
        height="34"
        fill={colorVar('--green')}
        className="bar-grow"
        style={{ animationDelay: '0.2s' }}
      />
      <rect
        x="56"
        y="16"
        width="10"
        height="46"
        fill={colorVar('--green')}
        className="bar-grow"
        style={{ animationDelay: '0.4s' }}
      />
      <path
        d="M20 44 L46 30 L82 14"
        stroke={colorVar('--green')}
        strokeWidth="2"
        fill="none"
        className="edge-anim"
      />
    </svg>
  )
}

/** C4: a person above a system box, joined by a relationship arrow. */
export function C4Tile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <circle
        cx="50"
        cy="10"
        r="5"
        fill="none"
        stroke={colorVar('--cyan')}
        strokeWidth="2"
      />
      <rect
        x="26"
        y="44"
        width="48"
        height="18"
        rx="3"
        fill="none"
        stroke={colorVar('--cyan')}
        strokeWidth="2"
      />
      <path
        d="M50 17 V44"
        stroke={colorVar('--cyan')}
        strokeWidth="2"
        fill="none"
        className="edge-anim"
      />
    </svg>
  )
}

/** Architecture: two service boxes joined through a junction dot. */
export function ArchitectureTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <rect
        x="6"
        y="24"
        width="24"
        height="22"
        rx="4"
        fill="none"
        stroke={colorVar('--violet')}
        strokeWidth="2"
      />
      <rect
        x="70"
        y="24"
        width="24"
        height="22"
        rx="4"
        fill="none"
        stroke={colorVar('--violet')}
        strokeWidth="2"
      />
      <circle cx="50" cy="35" r="4" fill={colorVar('--violet')} />
      <path
        d="M30 35 H46 M54 35 H70"
        stroke={colorVar('--violet')}
        strokeWidth="2"
        fill="none"
        className="edge-anim"
      />
    </svg>
  )
}

/** Pie: a circle split into three wedges. */
export function PieTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <circle
        cx="50"
        cy="35"
        r="26"
        fill="none"
        stroke={colorVar('--pink')}
        strokeWidth="2"
      />
      <path
        d="M50 35 V9 M50 35 L72.5 48 M50 35 L27.5 48"
        stroke={colorVar('--pink')}
        strokeWidth="2"
        fill="none"
        className="edge-anim"
      />
    </svg>
  )
}

/** Quadrant: a square split into four cells with one point. */
export function QuadrantTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <rect
        x="26"
        y="6"
        width="48"
        height="58"
        rx="3"
        fill="none"
        stroke={colorVar('--amber')}
        strokeWidth="2"
      />
      <path
        d="M50 6 V64 M26 35 H74"
        stroke={colorVar('--amber')}
        strokeWidth="2"
        fill="none"
        className="edge-anim"
      />
      <circle cx="62" cy="20" r="4" fill={colorVar('--amber')} />
    </svg>
  )
}

/** Gantt: three staggered task bars on a baseline. */
export function GanttTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <path
        d="M14 8 V60 H90"
        stroke={colorVar('--green')}
        strokeWidth="2"
        fill="none"
      />
      <rect
        x="20"
        y="14"
        width="30"
        height="8"
        rx="2"
        fill={colorVar('--green')}
      />
      <rect
        x="36"
        y="29"
        width="34"
        height="8"
        rx="2"
        fill={colorVar('--green')}
        className="edge-anim"
      />
      <rect
        x="58"
        y="44"
        width="26"
        height="8"
        rx="2"
        fill={colorVar('--green')}
      />
    </svg>
  )
}

/** Kanban: three columns, each with a card. */
export function KanbanTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <path
        d="M16 8 H38 V62 H16 Z M39 8 H61 V62 H39 Z M62 8 H84 V62 H62 Z"
        stroke={colorVar('--violet')}
        strokeWidth="2"
        fill="none"
        className="edge-anim"
      />
      <rect x="20" y="14" width="14" height="10" fill={colorVar('--violet')} />
      <rect x="43" y="14" width="14" height="10" fill={colorVar('--violet')} />
      <rect x="66" y="14" width="14" height="10" fill={colorVar('--violet')} />
    </svg>
  )
}

/** Mindmap: see the mindmap hub card. */
export function MindmapTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <circle cx="50" cy="35" r="7" fill={colorVar('--blue')} />
      <circle
        cx="82"
        cy="35"
        r="4"
        fill="none"
        stroke={colorVar('--blue')}
        strokeWidth="2"
      />
      <circle
        cx="18"
        cy="35"
        r="4"
        fill="none"
        stroke={colorVar('--blue')}
        strokeWidth="2"
      />
      <circle
        cx="50"
        cy="9"
        r="4"
        fill="none"
        stroke={colorVar('--blue')}
        strokeWidth="2"
      />
      <circle
        cx="50"
        cy="61"
        r="4"
        fill="none"
        stroke={colorVar('--blue')}
        strokeWidth="2"
      />
      <path
        d="M57 35 H78 M43 35 H22 M50 28 V13 M50 42 V57"
        fill="none"
        stroke={colorVar('--blue')}
        strokeWidth="2"
        className="edge-anim"
      />
    </svg>
  )
}

/** Timeline: see the timeline hub card. */
export function TimelineTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <path
        d="M10 35 H90"
        fill="none"
        stroke={colorVar('--cyan')}
        strokeWidth="2"
        className="edge-anim"
      />
      <circle cx="25" cy="35" r="4" fill={colorVar('--cyan')} />
      <circle cx="50" cy="35" r="4" fill={colorVar('--cyan')} />
      <circle cx="75" cy="35" r="4" fill={colorVar('--cyan')} />
      <path
        d="M25 35 V18 M50 35 V52 M75 35 V18"
        fill="none"
        stroke={colorVar('--cyan')}
        strokeWidth="2"
      />
    </svg>
  )
}

/** Requirement: see the requirement hub card. */
export function RequirementTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <rect
        x="12"
        y="10"
        width="30"
        height="20"
        rx="2"
        fill="none"
        stroke={colorVar('--amber')}
        strokeWidth="2"
      />
      <rect
        x="58"
        y="40"
        width="30"
        height="20"
        rx="2"
        fill="none"
        stroke={colorVar('--amber')}
        strokeWidth="2"
      />
      <path
        d="M42 20 H50 V50 H58"
        fill="none"
        stroke={colorVar('--amber')}
        strokeWidth="2"
        className="edge-anim"
      />
    </svg>
  )
}

/** Journey: see the journey hub card. */
export function JourneyTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <path
        d="M10 50 Q28 8 50 38 T90 20"
        fill="none"
        stroke={colorVar('--pink')}
        strokeWidth="2"
        className="edge-anim"
      />
      <circle cx="10" cy="50" r="3.5" fill={colorVar('--pink')} />
      <circle cx="50" cy="38" r="3.5" fill={colorVar('--pink')} />
      <circle cx="90" cy="20" r="3.5" fill={colorVar('--pink')} />
    </svg>
  )
}

/** Radar: see the radar hub card. */
export function RadarTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <polygon
        points="50,8 88,35 74,60 26,60 12,35"
        fill="none"
        stroke={colorVar('--green')}
        strokeWidth="2"
      />
      <polygon
        points="50,24 70,36 62,50 38,50 30,36"
        fill="none"
        stroke={colorVar('--green')}
        strokeWidth="2"
        className="edge-anim"
      />
    </svg>
  )
}

/** Packet: see the packet hub card. */
export function PacketTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <rect
        x="14"
        y="10"
        width="72"
        height="14"
        rx="2"
        fill="none"
        stroke={colorVar('--violet')}
        strokeWidth="2"
      />
      <rect
        x="14"
        y="28"
        width="72"
        height="14"
        rx="2"
        fill="none"
        stroke={colorVar('--violet')}
        strokeWidth="2"
      />
      <rect
        x="14"
        y="46"
        width="72"
        height="14"
        rx="2"
        fill="none"
        stroke={colorVar('--violet')}
        strokeWidth="2"
      />
      <path
        d="M50 10 V24 M32 28 V42 M68 28 V42 M30 46 V60"
        fill="none"
        stroke={colorVar('--violet')}
        strokeWidth="2"
      />
    </svg>
  )
}

/** GitGraph: see the gitgraph hub card. */
export function GitGraphTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <path
        d="M14 55 H86"
        fill="none"
        stroke={colorVar('--blue')}
        strokeWidth="2"
      />
      <path
        d="M32 55 C40 55 38 20 48 20 H62 C72 20 70 55 78 55"
        fill="none"
        stroke={colorVar('--blue')}
        strokeWidth="2"
        className="edge-anim"
      />
      <circle cx="14" cy="55" r="4" fill={colorVar('--blue')} />
      <circle cx="32" cy="55" r="4" fill={colorVar('--blue')} />
      <circle cx="48" cy="20" r="4" fill={colorVar('--blue')} />
      <circle cx="62" cy="20" r="4" fill={colorVar('--blue')} />
      <circle cx="86" cy="55" r="4" fill={colorVar('--blue')} />
    </svg>
  )
}

/** Sankey: see the sankey hub card. */
export function SankeyTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <rect
        x="12"
        y="8"
        width="6"
        height="54"
        rx="2"
        fill={colorVar('--cyan')}
      />
      <rect
        x="82"
        y="8"
        width="6"
        height="22"
        rx="2"
        fill={colorVar('--cyan')}
      />
      <rect
        x="82"
        y="40"
        width="6"
        height="22"
        rx="2"
        fill={colorVar('--cyan')}
      />
      <path
        d="M18 19 C50 19 50 19 82 19"
        fill="none"
        stroke={colorVar('--cyan')}
        strokeWidth="8"
      />
      <path
        d="M18 50 C50 50 50 51 82 51"
        fill="none"
        stroke={colorVar('--cyan')}
        strokeWidth="8"
        className="edge-anim"
      />
    </svg>
  )
}

/** Use Case: see the usecase hub card. */
export function UseCaseTile() {
  return (
    <svg viewBox="0 0 100 70" width="100%" height="70">
      <rect
        x="40"
        y="6"
        width="52"
        height="58"
        rx="3"
        fill="none"
        stroke={colorVar('--pink')}
        strokeWidth="2"
      />
      <ellipse
        cx="66"
        cy="22"
        rx="16"
        ry="8"
        fill="none"
        stroke={colorVar('--pink')}
        strokeWidth="2"
      />
      <ellipse
        cx="66"
        cy="48"
        rx="16"
        ry="8"
        fill="none"
        stroke={colorVar('--pink')}
        strokeWidth="2"
      />
      <circle
        cx="16"
        cy="28"
        r="5"
        fill="none"
        stroke={colorVar('--pink')}
        strokeWidth="2"
      />
      <path
        d="M16 33 V46 M8 38 H24 M16 46 L9 58 M16 46 L23 58"
        fill="none"
        stroke={colorVar('--pink')}
        strokeWidth="2"
      />
      <path
        d="M24 36 L50 24 M24 42 L50 48"
        fill="none"
        stroke={colorVar('--pink')}
        strokeWidth="2"
        className="edge-anim"
      />
    </svg>
  )
}

/**
 * One tile component per {@link GALLERY_TYPES} entry (`diagram-gallery-
 * teaser.tsx`), in the same order — index `i` here must line up with that
 * array's index `i`.
 */
export const GALLERY_TILES = [
  FlowchartTile,
  StateTile,
  SequenceTile,
  ClassTile,
  ERTile,
  XYChartTile,
  C4Tile,
  ArchitectureTile,
  PieTile,
  QuadrantTile,
  GanttTile,
  KanbanTile,
  MindmapTile,
  TimelineTile,
  RequirementTile,
  JourneyTile,
  RadarTile,
  PacketTile,
  GitGraphTile,
  SankeyTile,
  UseCaseTile,
]
