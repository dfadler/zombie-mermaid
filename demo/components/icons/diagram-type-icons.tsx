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
