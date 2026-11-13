/** @jsxRuntime automatic */
/**
 * The six animated diagram-type icons (#597) — split out of the original
 * `icons.tsx` (#934) as one family of the icon set.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */

import { type IconProps, StrokeIcon } from './base.tsx'

/**
 * A diagram-type icon's own props plus {@link IconProps}.
 *
 * `animated` defaults to `true`: these six are animated by design (#597's
 * whole point), so a caller only passes `false` for a genuinely frozen
 * rendering — a favicon, a printed page, a static export. Regardless of this
 * prop, the motion itself is enforced off whenever the viewer has
 * `prefers-reduced-motion: reduce` set. That enforcement lives in each
 * icon's own inline `<style>` block (a `@media` rule, not a JS check) —
 * deliberately, because these components commonly render through
 * `react-dom/server`'s `renderToStaticMarkup` into pages that ship no React
 * runtime at all (see pages.ts), so a JS-only guard would silently do
 * nothing on exactly the pages this animates on. When `animated` is
 * `false`, no `<style>` tag and no animation class is emitted at all —
 * there is nothing for the media query to override, and the icon draws its
 * plain rest-state paths.
 */
export interface DiagramTypeIconProps extends IconProps {
  /** Whether the icon's motion is enabled. Defaults to `true`. */
  animated?: boolean
}

/**
 * Flowchart — marching ants along the edge between two nodes.
 *
 * No canvas artboard names this icon (#597's design source is behavior, not
 * a mockup); the accent is `--blue`, tokens.tsx's own "Accent — flowchart"
 * colour. The dashed edge is the only animated element — the two node
 * rects and the arrowhead stay still, since flowchart motion is about flow
 * *along a path*, not the nodes themselves.
 */
export function FlowchartIcon({
  animated = true,
  ...props
}: DiagramTypeIconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--blue">
      {animated ? (
        <style>{`
          .zm-fc-edge {
            stroke-dasharray: 4 3;
            animation: zm-fc-flow 1.1s linear infinite;
          }
          @keyframes zm-fc-flow {
            to { stroke-dashoffset: -14; }
          }
          @media (prefers-reduced-motion: reduce) {
            .zm-fc-edge { animation: none; }
          }
        `}</style>
      ) : null}
      <rect x="2" y="3" width="8" height="6" rx="2" />
      <rect x="14" y="15" width="8" height="6" rx="2" />
      <path
        className={animated ? 'zm-fc-edge' : undefined}
        d="M10 6h4a2 2 0 0 1 2 2v7"
      />
      <polyline points="14 13 16 15 18 13" />
    </StrokeIcon>
  )
}

/**
 * State — a radar-ping pulse ringing out from the active state node.
 *
 * Accent `--violet`, tokens.tsx's "Accent — state". The start dot and
 * transition arrow stay still; only the ping ring (an expanding, fading
 * circle centred on the active node) animates, echoing how a state
 * diagram's motion is really about *arriving somewhere and staying* rather
 * than continuous flow.
 */
export function StateIcon({ animated = true, ...props }: DiagramTypeIconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--violet">
      {animated ? (
        <style>{`
          .zm-st-ping {
            transform-origin: 17.5px 12px;
            animation: zm-st-ping 1.8s ease-out infinite;
          }
          @keyframes zm-st-ping {
            0% { transform: scale(0.85); opacity: 0.55; }
            75%, 100% { transform: scale(1.7); opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            .zm-st-ping { animation: none; opacity: 0; }
          }
        `}</style>
      ) : null}
      <circle cx="3.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <path d="M5.5 12h6M9.5 9.5l2.5 2.5-2.5 2.5" />
      <rect x="13" y="7" width="9" height="10" rx="3" />
      {animated ? (
        <circle className="zm-st-ping" cx="17.5" cy="12" r="5.5" />
      ) : null}
    </StrokeIcon>
  )
}

/**
 * Sequence — two dashed messages flowing in opposite directions between
 * lifelines.
 *
 * Accent `--cyan` (one of tokens.tsx's six named accents; flowchart, state,
 * XY chart, and ER each have an explicit comment there, so sequence and
 * class take the two that don't — cyan and pink — by elimination). The two
 * message paths share one dash pattern but opposite `stroke-dashoffset`
 * keyframes, so they visibly travel toward each other's lifeline rather
 * than in lockstep.
 */
export function SequenceIcon({
  animated = true,
  ...props
}: DiagramTypeIconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--cyan">
      {animated ? (
        <style>{`
          .zm-sq-a, .zm-sq-b {
            stroke-dasharray: 3 3;
          }
          .zm-sq-a { animation: zm-sq-flow-a 1s linear infinite; }
          .zm-sq-b { animation: zm-sq-flow-b 1s linear infinite; }
          @keyframes zm-sq-flow-a {
            to { stroke-dashoffset: -12; }
          }
          @keyframes zm-sq-flow-b {
            to { stroke-dashoffset: 12; }
          }
          @media (prefers-reduced-motion: reduce) {
            .zm-sq-a, .zm-sq-b { animation: none; }
          }
        `}</style>
      ) : null}
      <rect x="3" y="2" width="6" height="3" rx="1" />
      <rect x="15" y="2" width="6" height="3" rx="1" />
      <line x1="6" y1="5" x2="6" y2="21" />
      <line x1="18" y1="5" x2="18" y2="21" />
      <path className={animated ? 'zm-sq-a' : undefined} d="M6 9.5h12" />
      <polyline points="15.5 8 18 9.5 15.5 11" />
      <path className={animated ? 'zm-sq-b' : undefined} d="M18 15.5H6" />
      <polyline points="8.5 14 6 15.5 8.5 17" />
    </StrokeIcon>
  )
}

/**
 * Class — a UML class box whose two field-separator lines draw in
 * sequentially.
 *
 * Accent `--pink`, the other of the two unassigned accents left after
 * flowchart/state/XY-chart/ER's explicit tokens.tsx comments (see
 * {@link SequenceIcon}). The name/attribute/method compartment marks stay
 * still; the two separator lines each animate `stroke-dashoffset` from
 * "undrawn" to "drawn" with a staggered `animation-delay`, so the second
 * line visibly starts after the first rather than both drawing at once.
 */
export function ClassIcon({ animated = true, ...props }: DiagramTypeIconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--pink">
      {animated ? (
        <style>{`
          .zm-cl-sep {
            stroke-dasharray: 16;
            animation: zm-cl-draw 2.4s ease-in-out infinite alternate;
          }
          .zm-cl-sep-2 { animation-delay: 0.5s; }
          @keyframes zm-cl-draw {
            from { stroke-dashoffset: 16; opacity: 0.35; }
            to { stroke-dashoffset: 0; opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .zm-cl-sep { animation: none; stroke-dashoffset: 0; opacity: 1; }
          }
        `}</style>
      ) : null}
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M7 6.5h6" />
      <line
        className={animated ? 'zm-cl-sep' : undefined}
        x1="4"
        y1="10"
        x2="20"
        y2="10"
      />
      <path d="M7 13h7M7 15.5h5" />
      <line
        className={animated ? 'zm-cl-sep zm-cl-sep-2' : undefined}
        x1="4"
        y1="17"
        x2="20"
        y2="17"
      />
      <path d="M7 19h5" />
    </StrokeIcon>
  )
}

/**
 * ER — the relationship diamond and its two connectors pulsing together.
 *
 * Accent `--green`, tokens.tsx's own "Accent — ER". The two entity rects
 * stay still; the diamond and its connector stubs are grouped in one `<g>`
 * so a single `opacity`/`scale` keyframe animates all three as one unit —
 * "pulsing together" means literally sharing one animated element, not
 * three separately-timed ones that happen to line up.
 */
export function ErIcon({ animated = true, ...props }: DiagramTypeIconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--green">
      {animated ? (
        <style>{`
          .zm-er-pulse {
            transform-origin: 12px 12px;
            animation: zm-er-pulse 1.6s ease-in-out infinite;
          }
          @keyframes zm-er-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.45; transform: scale(1.08); }
          }
          @media (prefers-reduced-motion: reduce) {
            .zm-er-pulse { animation: none; }
          }
        `}</style>
      ) : null}
      <rect x="2" y="9" width="6" height="6" rx="1" />
      <rect x="16" y="9" width="6" height="6" rx="1" />
      <g className={animated ? 'zm-er-pulse' : undefined}>
        <path d="M8 12h2M14 12h2" />
        <path d="M10 12l2-3 2 3-2 3z" />
      </g>
    </StrokeIcon>
  )
}

/**
 * XY chart — bars growing and shrinking like a live equalizer.
 *
 * Accent `--amber`, tokens.tsx's own "Accent — … XY chart". Each of the
 * four bars is a solid `currentColor` fill (matching {@link ThemesIcon}'s
 * and {@link MonoModeIcon}'s filled accent details, not another stroke
 * shape) so the bar-chart read stays solid at small sizes. Each bar scales
 * on its own `animation-delay`, and `transform-origin` is set per bar to
 * its own bottom-centre point in the icon's `0 0 24 24` user-space
 * coordinates — safe without a `transform-box` override, since that is the
 * default reference box for an SVG element's `transform-origin`.
 */
export function XyChartIcon({
  animated = true,
  ...props
}: DiagramTypeIconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--amber">
      {animated ? (
        <style>{`
          .zm-xy-bar { animation: zm-xy-eq 1.2s ease-in-out infinite; }
          .zm-xy-bar-1 { animation-delay: 0s; }
          .zm-xy-bar-2 { animation-delay: 0.15s; }
          .zm-xy-bar-3 { animation-delay: 0.3s; }
          .zm-xy-bar-4 { animation-delay: 0.45s; }
          @keyframes zm-xy-eq {
            0%, 100% { transform: scaleY(1); }
            50% { transform: scaleY(0.55); }
          }
          @media (prefers-reduced-motion: reduce) {
            .zm-xy-bar { animation: none; }
          }
        `}</style>
      ) : null}
      <path d="M2 20h20" />
      <rect
        className={animated ? 'zm-xy-bar zm-xy-bar-1' : undefined}
        x="4"
        y="12"
        width="3"
        height="8"
        fill="currentColor"
        stroke="none"
        style={animated ? { transformOrigin: '5.5px 20px' } : undefined}
      />
      <rect
        className={animated ? 'zm-xy-bar zm-xy-bar-2' : undefined}
        x="9"
        y="6"
        width="3"
        height="14"
        fill="currentColor"
        stroke="none"
        style={animated ? { transformOrigin: '10.5px 20px' } : undefined}
      />
      <rect
        className={animated ? 'zm-xy-bar zm-xy-bar-3' : undefined}
        x="14"
        y="15"
        width="3"
        height="5"
        fill="currentColor"
        stroke="none"
        style={animated ? { transformOrigin: '15.5px 20px' } : undefined}
      />
      <rect
        className={animated ? 'zm-xy-bar zm-xy-bar-4' : undefined}
        x="19"
        y="9"
        width="3"
        height="11"
        fill="currentColor"
        stroke="none"
        style={animated ? { transformOrigin: '20.5px 20px' } : undefined}
      />
    </StrokeIcon>
  )
}

/**
 * C4 — a dashed relationship line flowing from the person down to the
 * system box. Accent `--cyan` (the C4 profile's accent).
 */
export function C4Icon({ animated = true, ...props }: DiagramTypeIconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--cyan">
      {animated ? (
        <style>{`
          .zm-c4-edge {
            stroke-dasharray: 3 3;
            animation: zm-c4-flow 1s linear infinite;
          }
          @keyframes zm-c4-flow {
            to { stroke-dashoffset: -12; }
          }
          @media (prefers-reduced-motion: reduce) {
            .zm-c4-edge { animation: none; }
          }
        `}</style>
      ) : null}
      <circle cx="12" cy="5" r="2.5" />
      <rect x="4" y="15" width="16" height="6" rx="2" />
      <path className={animated ? 'zm-c4-edge' : undefined} d="M12 8v7" />
    </StrokeIcon>
  )
}

/**
 * Architecture — two services linked by a flowing dashed edge.
 * Accent `--violet`.
 */
export function ArchitectureIcon({
  animated = true,
  ...props
}: DiagramTypeIconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--violet">
      {animated ? (
        <style>{`
          .zm-ar-edge {
            stroke-dasharray: 3 3;
            animation: zm-ar-flow 1s linear infinite;
          }
          @keyframes zm-ar-flow {
            to { stroke-dashoffset: -12; }
          }
          @media (prefers-reduced-motion: reduce) {
            .zm-ar-edge { animation: none; }
          }
        `}</style>
      ) : null}
      <rect x="2" y="8" width="7" height="8" rx="2" />
      <rect x="15" y="8" width="7" height="8" rx="2" />
      <path className={animated ? 'zm-ar-edge' : undefined} d="M9 12h6" />
    </StrokeIcon>
  )
}

/**
 * Pie — one wedge pulls out and settles back. Accent `--pink`.
 */
export function PieIcon({ animated = true, ...props }: DiagramTypeIconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--pink">
      {animated ? (
        <style>{`
          .zm-pie-slice { animation: zm-pie-pop 1.8s ease-in-out infinite; }
          @keyframes zm-pie-pop {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(1.2px, -1.2px); }
          }
          @media (prefers-reduced-motion: reduce) {
            .zm-pie-slice { animation: none; }
          }
        `}</style>
      ) : null}
      <path d="M11 4a8 8 0 1 0 8 8h-8z" />
      <path
        className={animated ? 'zm-pie-slice' : undefined}
        d="M13 2v7h7a7 7 0 0 0-7-7z"
      />
    </StrokeIcon>
  )
}

/**
 * Quadrant — a point drifts across the cross-hairs. Accent `--amber`.
 */
export function QuadrantIcon({
  animated = true,
  ...props
}: DiagramTypeIconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--amber">
      {animated ? (
        <style>{`
          .zm-quad-dot { animation: zm-quad-drift 2s ease-in-out infinite; }
          @keyframes zm-quad-drift {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(-1.5px, 1.5px); }
          }
          @media (prefers-reduced-motion: reduce) {
            .zm-quad-dot { animation: none; }
          }
        `}</style>
      ) : null}
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 3v18M3 12h18" />
      <circle
        className={animated ? 'zm-quad-dot' : undefined}
        cx="16.5"
        cy="7.5"
        r="1.8"
        fill="currentColor"
        stroke="none"
      />
    </StrokeIcon>
  )
}

/**
 * Gantt — three staggered task bars. Accent `--green`.
 */
export function GanttIcon({ animated = true, ...props }: DiagramTypeIconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--green">
      {animated ? (
        <style>{`
          .zm-gantt-bar { animation: zm-gantt-slide 2s ease-in-out infinite; }
          @keyframes zm-gantt-slide {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(1.5px); }
          }
          @media (prefers-reduced-motion: reduce) {
            .zm-gantt-bar { animation: none; }
          }
        `}</style>
      ) : null}
      <path d="M3 3v18h18" />
      <rect
        x="6"
        y="6"
        width="7"
        height="3"
        rx="1"
        fill="currentColor"
        stroke="none"
      />
      <rect
        className={animated ? 'zm-gantt-bar' : undefined}
        x="9"
        y="11"
        width="8"
        height="3"
        rx="1"
        fill="currentColor"
        stroke="none"
      />
      <rect
        x="13"
        y="16"
        width="6"
        height="3"
        rx="1"
        fill="currentColor"
        stroke="none"
      />
    </StrokeIcon>
  )
}

/**
 * Kanban — three columns, one card slides down. Accent `--violet`.
 */
export function KanbanIcon({
  animated = true,
  ...props
}: DiagramTypeIconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--violet">
      {animated ? (
        <style>{`
          .zm-kan-card { animation: zm-kan-slide 2s ease-in-out infinite; }
          @keyframes zm-kan-slide {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(0, 2px); }
          }
          @media (prefers-reduced-motion: reduce) {
            .zm-kan-card { animation: none; }
          }
        `}</style>
      ) : null}
      <rect x="3" y="3" width="5" height="18" rx="1" />
      <rect x="9.5" y="3" width="5" height="18" rx="1" />
      <rect x="16" y="3" width="5" height="18" rx="1" />
      <rect
        className={animated ? 'zm-kan-card' : undefined}
        x="10.5"
        y="5.5"
        width="3"
        height="3"
        fill="currentColor"
        stroke="none"
      />
    </StrokeIcon>
  )
}

/**
 * Mindmap — a central node with four branches, the centre pulses. Accent `--blue`.
 */
export function MindmapIcon({
  animated = true,
  ...props
}: DiagramTypeIconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--blue">
      {animated ? (
        <style>{`
          .zm-mindmap-a { transform-box: fill-box; transform-origin: center; animation: zm-mindmap-k 2s ease-in-out infinite; }
          @keyframes zm-mindmap-k {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.3); }
          }
          @media (prefers-reduced-motion: reduce) {
            .zm-mindmap-a { animation: none; }
          }
        `}</style>
      ) : null}
      <circle
        className={animated ? 'zm-mindmap-a' : undefined}
        cx="12"
        cy="12"
        r="2.5"
        fill="currentColor"
        stroke="none"
      />
      <circle cx="20.5" cy="12" r="1.5" />
      <circle cx="3.5" cy="12" r="1.5" />
      <circle cx="12" cy="3.5" r="1.5" />
      <circle cx="12" cy="20.5" r="1.5" />
      <path d="M14.5 12H19 M9.5 12H5 M12 9.5V5 M12 14.5V19" />
    </StrokeIcon>
  )
}

/**
 * Timeline — an axis with three events, the middle one pulses. Accent `--cyan`.
 */
export function TimelineIcon({
  animated = true,
  ...props
}: DiagramTypeIconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--cyan">
      {animated ? (
        <style>{`
          .zm-timeline-a { transform-box: fill-box; transform-origin: center; animation: zm-timeline-k 2s ease-in-out infinite; }
          @keyframes zm-timeline-k {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.5); }
          }
          @media (prefers-reduced-motion: reduce) {
            .zm-timeline-a { animation: none; }
          }
        `}</style>
      ) : null}
      <path d="M3 12H21" />
      <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle
        className={animated ? 'zm-timeline-a' : undefined}
        cx="12"
        cy="12"
        r="1.4"
        fill="currentColor"
        stroke="none"
      />
      <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <path d="M6 12V7 M12 12V17 M18 12V7" />
    </StrokeIcon>
  )
}

/**
 * Requirement — two boxes joined by a dashed relationship that marches. Accent `--amber`.
 */
export function RequirementIcon({
  animated = true,
  ...props
}: DiagramTypeIconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--amber">
      {animated ? (
        <style>{`
          .zm-requirement-a { stroke-dasharray: 2 2; animation: zm-requirement-k 2s ease-in-out infinite; }
          @keyframes zm-requirement-k {
            0%, 100% { stroke-dashoffset: 0; }
            50% { stroke-dashoffset: -4; }
          }
          @media (prefers-reduced-motion: reduce) {
            .zm-requirement-a { animation: none; }
          }
        `}</style>
      ) : null}
      <rect x="3" y="4" width="8" height="6" rx="1" />
      <rect x="13" y="14" width="8" height="6" rx="1" />
      <path
        className={animated ? 'zm-requirement-a' : undefined}
        d="M11 7h3v10"
      />
    </StrokeIcon>
  )
}

/**
 * User journey — a score line over three steps, the middle step bobs. Accent `--pink`.
 */
export function JourneyIcon({
  animated = true,
  ...props
}: DiagramTypeIconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--pink">
      {animated ? (
        <style>{`
          .zm-journey-a {  animation: zm-journey-k 2s ease-in-out infinite; }
          @keyframes zm-journey-k {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-2px); }
          }
          @media (prefers-reduced-motion: reduce) {
            .zm-journey-a { animation: none; }
          }
        `}</style>
      ) : null}
      <path d="M3 17L8 9L13 14L21 6" />
      <circle cx="3" cy="17" r="1.4" fill="currentColor" stroke="none" />
      <circle
        className={animated ? 'zm-journey-a' : undefined}
        cx="13"
        cy="14"
        r="1.4"
        fill="currentColor"
        stroke="none"
      />
      <circle cx="21" cy="6" r="1.4" fill="currentColor" stroke="none" />
    </StrokeIcon>
  )
}

/**
 * Radar — an outer pentagon with an inner curve that breathes. Accent `--green`.
 */
export function RadarIcon({ animated = true, ...props }: DiagramTypeIconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--green">
      {animated ? (
        <style>{`
          .zm-radar-a { transform-box: fill-box; transform-origin: center; animation: zm-radar-k 2s ease-in-out infinite; }
          @keyframes zm-radar-k {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.3); }
          }
          @media (prefers-reduced-motion: reduce) {
            .zm-radar-a { animation: none; }
          }
        `}</style>
      ) : null}
      <polygon points="12,3 20,9 17,19 7,19 4,9" />
      <polygon
        className={animated ? 'zm-radar-a' : undefined}
        points="12,8 16,11 14.5,15.5 9.5,15.5 8,11"
      />
    </StrokeIcon>
  )
}

/**
 * Packet — three header rows, one field flashes. Accent `--violet`.
 */
export function PacketIcon({
  animated = true,
  ...props
}: DiagramTypeIconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--violet">
      {animated ? (
        <style>{`
          .zm-packet-a {  animation: zm-packet-k 2s ease-in-out infinite; }
          @keyframes zm-packet-k {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
          @media (prefers-reduced-motion: reduce) {
            .zm-packet-a { animation: none; }
          }
        `}</style>
      ) : null}
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <rect x="3" y="10" width="18" height="4" rx="1" />
      <rect x="3" y="16" width="18" height="4" rx="1" />
      <rect
        className={animated ? 'zm-packet-a' : undefined}
        x="3"
        y="10"
        width="6"
        height="4"
        fill="currentColor"
        stroke="none"
      />
    </StrokeIcon>
  )
}

/**
 * Git graph — a main lane with a branch, the branch commit bobs. Accent `--blue`.
 */
export function GitGraphIcon({
  animated = true,
  ...props
}: DiagramTypeIconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--blue">
      {animated ? (
        <style>{`
          .zm-gitgraph-a {  animation: zm-gitgraph-k 2s ease-in-out infinite; }
          @keyframes zm-gitgraph-k {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(2px); }
          }
          @media (prefers-reduced-motion: reduce) {
            .zm-gitgraph-a { animation: none; }
          }
        `}</style>
      ) : null}
      <path d="M4 18H20" />
      <path d="M8 18C10 18 9 7 12 7H13C16 7 15 18 17 18" />
      <circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="20" cy="18" r="1.4" fill="currentColor" stroke="none" />
      <circle
        className={animated ? 'zm-gitgraph-a' : undefined}
        cx="12"
        cy="7"
        r="1.4"
        fill="currentColor"
        stroke="none"
      />
      <circle cx="17" cy="18" r="1.4" fill="currentColor" stroke="none" />
    </StrokeIcon>
  )
}

/**
 * Sankey — a source bar fanning into two sinks, the lower flow fades. Accent `--cyan`.
 */
export function SankeyIcon({
  animated = true,
  ...props
}: DiagramTypeIconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--cyan">
      {animated ? (
        <style>{`
          .zm-sankey-a {  animation: zm-sankey-k 2s ease-in-out infinite; }
          @keyframes zm-sankey-k {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.35; }
          }
          @media (prefers-reduced-motion: reduce) {
            .zm-sankey-a { animation: none; }
          }
        `}</style>
      ) : null}
      <rect
        x="3"
        y="4"
        width="2"
        height="16"
        fill="currentColor"
        stroke="none"
      />
      <rect
        x="19"
        y="4"
        width="2"
        height="7"
        fill="currentColor"
        stroke="none"
      />
      <rect
        x="19"
        y="13"
        width="2"
        height="7"
        fill="currentColor"
        stroke="none"
      />
      <path d="M5 7.5 C12 7.5 12 7.5 19 7.5" strokeWidth="3" opacity="0.6" />
      <path
        className={animated ? 'zm-sankey-a' : undefined}
        d="M5 16.5 C12 16.5 12 16.5 19 16.5"
        strokeWidth="3"
        opacity="0.6"
      />
    </StrokeIcon>
  )
}
