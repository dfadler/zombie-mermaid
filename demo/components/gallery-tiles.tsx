/** @jsxRuntime automatic */
/**
 * The six small animated SVG illustrations `DiagramGalleryTeaser`
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
]
