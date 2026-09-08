// ============================================================================
// Parsed graph — logical structure extracted from Mermaid text
// ============================================================================

import type { ElkNode } from 'elkjs'
import type { InitConfig, CurveStyle } from './init-directive.ts'

// `LayoutCache`'s shape is declared here rather than beside
// `createLayoutCache()`/`elkLayoutSync()` in
// `@zombie-mermaid/svg-renderer`'s `elk-instance.ts` because
// `RenderOptions.layoutCache` below references it: a `core` module that
// type-imported `svg-renderer` would put a cycle in the type graph, which
// `core` — a dependency of both renderers — must not have
// (zombie-mermaid#625, umbrella #620). Only the *shape* moved; every
// function that builds or reads a cache still lives in `svg-renderer`, and
// `elkjs` is a type-only import here, erased before anything is bundled.
//
// The doc comment below is deliberately byte-identical to the one this
// interface carried in `elk-instance.ts` — api-extractor copies it into
// the published `dist/index.d.ts`, so editing it would change the shipped
// declarations. Its "outside this module" still means `elk-instance.ts`,
// which remains the only place a `LayoutCache` is created or read.
/**
 * Opt-in bounded LRU cache for `elkLayoutSync()` results.
 *
 * Off by default — `elkLayoutSync()` only consults a cache when one is
 * explicitly passed in, so existing callers see no behavior change.
 * Create one with `createLayoutCache()` and reuse it across renders (e.g.
 * module scope, or a `useRef` in React) — a fresh cache per render defeats
 * the point.
 *
 * The `map`/`maxSize` fields are implementation detail exposed only so
 * `elkLayoutSync()` (and tests) can read/mutate them directly without a
 * class; treat a `LayoutCache` as opaque from outside this module.
 */
export interface LayoutCache {
  /** @internal */
  readonly map: Map<string, ElkNode>
  /** @internal */
  readonly maxSize: number
}

export interface MermaidGraph {
  direction: Direction
  nodes: Map<string, MermaidNode>
  edges: MermaidEdge[]
  subgraphs: MermaidSubgraph[]
  classDefs: Map<string, Record<string, string>>
  /** Maps node IDs to their class names (from `class X className` or `:::className` shorthand) */
  classAssignments: Map<string, string>
  /** Maps node IDs to inline styles (from `style X fill:#f00,stroke:#333`) */
  nodeStyles: Map<string, Record<string, string>>
  /** Maps edge indices (or 'default') to inline styles from `linkStyle` directives */
  linkStyles: Map<number | 'default', Record<string, string>>
  /** Maps node IDs to interactions declared by `click` statements */
  interactions: Map<string, NodeInteraction>
  /** Configuration the diagram set for itself via `%%{init: ...}%%` */
  initConfig?: InitConfig
}

export type Direction = 'TD' | 'TB' | 'LR' | 'BT' | 'RL'

export interface MermaidNode {
  id: string
  label: string
  shape: NodeShape
}

export type NodeShape =
  | 'rectangle'
  | 'rounded'
  | 'diamond'
  | 'stadium'
  | 'circle'
  // Batch 1 additions
  | 'subroutine' // [[text]]  — double-bordered rectangle
  | 'doublecircle' // (((text))) — concentric circles
  | 'hexagon' // {{text}}  — six-sided polygon
  // Batch 2 additions
  | 'cylinder' // [(text)]  — database cylinder
  | 'asymmetric' // >text]    — flag/banner shape
  | 'trapezoid' // [/text\]  — wider bottom
  | 'trapezoid-alt' // [\text/]  — wider top
  // Parallelogram — note the delimiters mirror rather than oppose, which is
  // what distinguishes these from the trapezoids above: [/…/] not [/…\].
  | 'parallelogram' // [/text/]  — leans right
  | 'parallelogram-alt' // [\text\]  — leans left
  // Batch 3 state diagram pseudostates
  | 'state-start' // filled circle (start pseudostate)
  | 'state-end' // bullseye circle (end pseudostate)
  // ---------------------------------------------------------------------
  // Expanded-syntax shapes — reachable via `A@{ shape: ... }` only; the
  // classic bracket syntax has no spelling for them. See
  // src/expanded-shapes.ts for the full name→shape alias table.
  // ---------------------------------------------------------------------
  | 'document' // wavy-bottomed page
  | 'stacked-document' // document with offset copies behind it
  | 'stacked-process' // rectangle with offset copies behind it
  | 'card' // rectangle with a notched top-left corner
  | 'lined-process' // rectangle with a vertical rule inset from the left
  | 'divided-process' // rectangle split by a horizontal rule
  | 'window-pane' // rectangle quartered by a cross
  | 'triangle' // apex up
  | 'flipped-triangle' // apex down
  | 'filled-circle' // solid dot — junction
  | 'crossed-circle' // circle with an X through it — summary
  | 'fork-join' // solid bar
  | 'notched-pentagon' // rectangle with clipped top corners — loop limit
  | 'sloped-rectangle' // sloped top edge — manual input
  | 'flag' // wavy top and bottom — paper tape
  | 'bow-tie-rectangle' // concave left and right edges — stored data
  | 'half-rounded-rectangle' // one rounded end — delay
  | 'brace' // left brace only
  | 'brace-right' // right brace only
  | 'braces' // braces on both sides
  | 'bolt' // lightning bolt — communication link
  | 'text' // label with no outline
  | 'anchor' // invisible point

export interface MermaidEdge {
  source: string
  target: string
  label?: string
  style: EdgeStyle
  /** Whether to render an arrowhead at the start (source end) of the edge */
  hasArrowStart: boolean
  /** Whether to render an arrowhead at the end (target end) of the edge */
  hasArrowEnd: boolean
  /**
   * Terminator shape at the source end when it's a circle/cross marker
   * (`o--`/`x--`) rather than a plain arrowhead. Undefined for a regular
   * `<`-style arrowhead or no marker at all — `hasArrowStart` alone still
   * governs whether anything is drawn there. Currently consumed by the
   * ASCII renderer only (see issue #330); the SVG renderer still draws a
   * plain arrowhead for these.
   */
  startMarker?: 'circle' | 'cross'
  /** Terminator shape at the target end (`--o`/`--x`). See `startMarker`. */
  endMarker?: 'circle' | 'cross'
  /** Edge id from `A e1@--> B` (Mermaid v11.10.0+), for `e1@{ ... }` and CSS targeting */
  id?: string
  /** Set by `e1@{ animate: true }` — renders as a marching-ants dash */
  animate?: boolean
}

/**
 * An interaction attached to a node by a `click` statement.
 *
 * This renderer emits static SVG and never executes diagram-supplied script,
 * so a `call`/callback binding is parsed but not invoked — see
 * docs/diagrams.md and docs/decisions/no-script-interactivity.md. An `href`
 * becomes a real SVG link and a tooltip becomes a `<title>`.
 */
export interface NodeInteraction {
  /** `click A "https://..."` — rendered as an <a> wrapper */
  href?: string
  /** Link target, e.g. `_blank` */
  target?: string
  /** Tooltip text — rendered as a <title> child */
  tooltip?: string
  /**
   * `click A call fn()` — the raw expression text (`fn()`), exposed as data
   * only. Nothing in the rendered SVG carries it and the library never
   * evaluates it; a host that trusts its diagram source reads it from
   * `parseMermaid(source).interactions` and binds behaviour to the node's
   * `data-id` attribute itself:
   *
   * ```ts
   * for (const [id, { callback }] of parseMermaid(source).interactions) {
   *   if (callback === 'showDetail()') {
   *     svgRoot.querySelector(`[data-id="${id}"]`)
   *       ?.addEventListener('click', () => showDetail(id))
   *   }
   * }
   * ```
   */
  callback?: string
}

export type EdgeStyle =
  | 'solid'
  | 'dotted'
  | 'thick'
  /** `A ~~~ B` — participates in layout but draws no line or arrowhead. */
  | 'invisible'

export interface MermaidSubgraph {
  id: string
  label: string
  nodeIds: string[]
  children: MermaidSubgraph[]
  /** Optional direction override for this subgraph's internal layout */
  direction?: Direction
}

// ============================================================================
// Positioned graph — after ELK layout, ready for SVG rendering
// ============================================================================

export interface PositionedGraph {
  width: number
  height: number
  nodes: PositionedNode[]
  edges: PositionedEdge[]
  groups: PositionedGroup[]
}

export interface PositionedNode {
  id: string
  label: string
  shape: NodeShape
  x: number
  y: number
  width: number
  height: number
  /** Inline styles resolved from classDef + explicit `style` statements — override theme defaults */
  inlineStyle?: Record<string, string>
  /** Custom class name assigned via `class A className` or `:::className` shorthand — emitted onto the rendered element's `class` attribute so external CSS can target it */
  className?: string
  /** Interaction from a `click` statement — an href wraps the node in an <a> */
  interaction?: NodeInteraction
}

export interface PositionedEdge {
  source: string
  target: string
  label?: string
  style: EdgeStyle
  hasArrowStart: boolean
  hasArrowEnd: boolean
  /** Full path including bends — array of {x, y} points */
  points: Point[]
  /** Layout-computed label center position (avoids label-label collisions) */
  labelPosition?: Point
  /** Inline styles resolved from `linkStyle` directives — override theme defaults */
  inlineStyle?: Record<string, string>
  /** Edge id from `A e1@--> B`, emitted as data-id for CSS targeting */
  id?: string
  /** Set by `e1@{ animate: true }` — renders as a marching-ants dash */
  animate?: boolean
}

export interface Point {
  x: number
  y: number
}

export interface PositionedGroup {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  children: PositionedGroup[]
}

// ============================================================================
// Render options — user-facing configuration
//
// Color theming uses CSS custom properties: --bg and --fg are required,
// optional enrichment variables (--line, --accent, --muted, --surface,
// --border) add richer color from Shiki themes or custom palettes.
// See packages/core/src/theme.ts for the full variable system.
// ============================================================================

export interface RenderOptions {
  /** Background color → CSS variable --bg. Default: '#FFFFFF' */
  bg?: string
  /** Foreground / primary text color → CSS variable --fg. Default: '#27272A' */
  fg?: string

  // -- Optional enrichment colors (fall back to color-mix from bg/fg) --

  /** Edge/connector color → CSS variable --line */
  line?: string
  /** Arrow heads, highlights → CSS variable --accent */
  accent?: string
  /** Secondary text, edge labels → CSS variable --muted */
  muted?: string
  /** Node/box fill tint → CSS variable --surface */
  surface?: string
  /** Node/group stroke color → CSS variable --border */
  border?: string

  /** Font family for all text. Default: 'Inter' */
  font?: string
  /** Canvas padding in px. Default: 40. Flowchart/state diagrams only — class/ER diagrams use fixed internal padding. */
  padding?: number
  /** Horizontal spacing between sibling nodes. Default: 28. Flowchart/state diagrams only — class/ER diagrams use fixed internal spacing. */
  nodeSpacing?: number
  /** Vertical spacing between layers. Default: 48. Flowchart/state diagrams only — class/ER diagrams use fixed internal spacing. */
  layerSpacing?: number
  /** Currently unused — accepted for forward compatibility but not read anywhere. */
  componentSpacing?: number
  /** Whether to bundle overlapping fan-out/fan-in edge paths into shared trunks to reduce visual clutter. Default: true */
  mergeEdges?: boolean
  /**
   * Force the diagram's layout direction, overriding the one its source
   * declares — a flowchart's `graph LR` / `flowchart TD` header, or a state
   * diagram's / ER diagram's top-level `direction LR` line. Applied after
   * parsing and before layout, so the source text is never rewritten and
   * `parseMermaid()` output is unaffected.
   *
   * Replaces only the *top-level* direction. A nested subgraph's or
   * composite state's own `direction` line still applies on top of this
   * override, exactly as it does on top of the diagram's own header — the
   * override behaves as if the caller had written that direction in the
   * source header, nothing more.
   *
   * Flowchart, state, and ER diagrams only — the three diagram types that
   * have a direction concept to override. Sequence, class, and XY-chart
   * diagrams ignore it (no error; output is identical with or without it).
   *
   * Unset (the default) keeps the source's direction, so existing output is
   * unchanged. See issue #276.
   */
  direction?: Direction
  /** Render with transparent background (no background style on SVG). Default: false */
  transparent?: boolean
  /**
   * Render-target-scoped interactivity level. Declarative only — this
   * library never emits `<script>`; see
   * docs/decisions/no-script-interactivity.md for the tier model this maps
   * to (tier 1: `<title>`/text; tier 2: `<a href>`, CSS `:hover`, CSS
   * animation; tier 3: `click ... call fn()`, recorded as data, never
   * executed). Default: `'static'`.
   *
   * - `'none'` — strips flowchart/state-diagram edge animation
   *   (`e1@{ animate: true }`), and strips `click`-based links
   *   (`<a href>`) and `<title>` tooltips. Intended for print/rasterized
   *   output: a CSS `@keyframes` animation would otherwise silently
   *   render as a single static frame with no indication that motion
   *   was intended, and a link is meaningless once rasterized.
   * - `'static'` — default. Tier 1 + tier 2 minus motion: `click`-based
   *   links and `<title>` tooltips still render, but flowchart/state-diagram
   *   edge animation does not — a diagram that opts into
   *   `e1@{ animate: true }` renders as a still line unless `'full'` is
   *   requested. xychart hover tooltips stay off unless requested via
   *   `'full'` or the deprecated `interactive: true` below. This is a
   *   breaking change from earlier releases, where `'static'` (and the
   *   default) still animated — animation is tier-2 *motion*, which the
   *   stricter `'static'` reading excludes; see the ADR.
   * - `'full'` — also enables flowchart/state-diagram edge animation and
   *   xychart hover tooltips.
   */
  interactivity?: 'none' | 'static' | 'full'
  /**
   * @deprecated Use `interactivity` instead. Enable hover tooltips on chart
   * data points (xychart only). Default: false.
   *
   * When `interactivity` is not set, this boolean still controls xychart
   * tooltips as before (`true` behaves like `interactivity: 'full'` for
   * that one effect). When `interactivity` *is* set, it takes precedence
   * and this field is ignored.
   */
  interactive?: boolean
  /** Stamp the original diagram source onto the root `<svg>` as a `data-src` attribute (HTML-escaped). Default: false */
  embedSource?: boolean

  // The `src/theme.ts` path below is deliberately left at its pre-#625
  // spelling (this file's `MIX` table now lives at
  // packages/core/src/theme.ts). api-extractor copies this JSDoc verbatim
  // into the published `dist/index.d.ts`, and #625 is verified by that
  // file being byte-identical to the pre-split build — rewording it would
  // break the check that proves the move changed nothing. Correct it in a
  // change that is allowed to move those bytes.
  /**
   * Replace every CSS `var(--…)` and `color-mix(…)` in the output with its
   * computed sRGB value (`#rrggbb`, or `rgba()` when translucent), using
   * the same mix percentages the `<style>` block declares (see
   * `MIX` in src/theme.ts — there is one table, not a copy). Default: false.
   *
   * Browsers evaluate both natively, so the default output stays a live
   * function of its CSS custom properties (docs/theming.md). Rasterizers
   * and non-browser SVG consumers — resvg, librsvg, Inkscape, ImageMagick —
   * implement neither and render the whole theme as black; turn this on
   * for any output headed to one of them (GitHub issue #456).
   *
   * Trade-off: the result is a fixed palette. Overriding `--bg`/`--fg` on
   * the embedded SVG no longer restyles it, and passing a `var(...)`
   * reference as a color (the React live-theming pattern) has nothing to
   * resolve against — such references, and any `var()` this library did
   * not declare itself (e.g. a host-page font variable), are left as-is.
   */
  resolveColors?: boolean

  /**
   * CSP nonce to stamp on every `<style>` element in the output (see GitHub
   * issue #216).
   *
   * The renderer styles its SVG with an inline `<style>` element (the theme
   * block; flowcharts with `e1@{ animate: true }` edges and xycharts add a
   * second one). A host page whose `Content-Security-Policy` has a
   * `style-src` without `'unsafe-inline'` blocks those, and the diagram
   * silently renders unstyled. The standard fix is a per-response nonce:
   * the host generates one, lists it as `style-src 'nonce-<value>'`, and
   * puts `nonce="<value>"` on each element it wants to allow. Pass that
   * value here and every emitted `<style>` gets it — one `<style>` left
   * un-nonced is enough to lose the whole diagram's styling, so this is
   * applied at the single shared emission point rather than per diagram
   * type.
   *
   * The value is attribute-escaped on output. An empty string is treated as
   * unset. Default: undefined (no `nonce` attribute).
   *
   * A nonce only authorises `<style>` *elements* — it cannot authorise a
   * `style="…"` *attribute* (browsers apply nonces to elements only), so the
   * root `<svg style="--bg: …">` attribute stays blocked under the same
   * policy. Pair this with `styleAttribute: false` and put the theme
   * variables in your own stylesheet; see that option.
   */
  nonce?: string

  /**
   * Emit the root `<svg style="--bg: …; --fg: …; background: var(--bg)">`
   * attribute. Default: true.
   *
   * That attribute is how the theme colours reach the SVG: every rule in
   * the embedded `<style>` block resolves against the `--bg`/`--fg`/…
   * custom properties it sets. Under a strict `Content-Security-Policy`
   * (`style-src` without `'unsafe-inline'`) the browser drops it, and no
   * `nonce` can rescue it — nonces apply to elements, never attributes —
   * so the diagram loses its colours even when the `<style>` element itself
   * is allowed (see GitHub issue #216).
   *
   * Set this to `false` to leave the attribute out entirely. The host must
   * then define the same custom properties on the SVG or an ancestor from
   * its own (nonced or external) stylesheet; `themeCssVariables(options)`
   * returns the exact declaration list the attribute would have carried,
   * so the two can't drift:
   *
   * ```ts
   * const opts = { bg: '#fff', fg: '#000', nonce, styleAttribute: false }
   * const svg = renderMermaidSVG(code, opts)
   * const css = `.diagram svg { ${themeCssVariables(opts)} }`
   * // `<style nonce="…">${css}</style>` + `<div class="diagram">${svg}</div>`
   * ```
   *
   * With the attribute gone, the SVG has no inline `background` either; the
   * declarations from `themeCssVariables()` include it (unless
   * `transparent`) so the host's rule restores it. Only the *root* `style`
   * attribute is affected: a per-node `style A font-family:…` override
   * still renders as that node's own `style` attribute, since it's diagram
   * content rather than theming, and under such a CSP it is simply ignored
   * by the browser. `nonce` and this option are independent — a host using
   * hashes rather than nonces may want only this one.
   */
  styleAttribute?: boolean

  /**
   * Accessible name for the rendered SVG (see GitHub issue #215). Rendered
   * as `role="img"` + `aria-labelledby` pointing at a `<title>` child
   * holding this text — the standard SVG/WAI-ARIA technique for naming an
   * inline image. Without a name, assistive tech either treats the SVG as a
   * plain group (every node/edge label announced individually, out of
   * reading order) or skips it — a WCAG 1.1.1 failure for diagrams embedded
   * in a page.
   *
   * Supply your own description of what the diagram shows (e.g. "Flowchart:
   * Build → Test → Ship") — this library does not auto-generate one, since a
   * fabricated summary like "flowchart with 3 nodes" would be a confidently
   * useless accessible name. When omitted, the SVG still gets `role="img"`
   * (so it's read as one image, not a leaky group) but claims no name — the
   * same as an `<img>` with no `alt`.
   *
   * Ignored when `decorative` is true. Default: undefined (no name).
   *
   * If the diagram has a `click A "url"` link, `role="img"` is never
   * applied regardless of this option — see `decorative` below.
   */
  title?: string

  /**
   * Mark the diagram as decorative — already described in surrounding
   * prose, so it shouldn't be announced as its own image. Emits
   * `aria-hidden="true"` on the root `<svg>` instead of
   * `role`/`aria-labelledby`/`<title>`; `title`, if also given, is ignored.
   * Default: false
   *
   * Silently overridden (no `aria-hidden`) if the diagram has any
   * `click A "url"` link: that renders as a real, focusable `<a href>`
   * inside the SVG, and `aria-hidden="true"` on an ancestor of a focusable
   * element is an explicit WAI-ARIA violation — assistive tech would drop
   * the link from the accessibility tree while it stays reachable by Tab.
   * `title`, if also given, still applies in that case (see #239).
   */
  decorative?: boolean

  /**
   * Edge path interpolation for flowcharts and state diagrams.
   * Default: 'linear'. A diagram's own
   * `%%{init: {"flowchart": {"curve": ...}}}%%` supplies this when the caller
   * does not; an explicit value here always wins.
   */
  curve?: CurveStyle

  /**
   * Font size overrides (px). Fields left unspecified fall back to their
   * default. Applies to all diagram types (flowchart, sequence, class, ER).
   */
  fontSizes?: {
    /** Node label text. Default: 13 */
    nodeLabel?: number
    /** Edge label text. Default: 11 */
    edgeLabel?: number
    /** Subgraph header text. Default: 12 */
    groupHeader?: number
  }

  /**
   * Sequence-diagram layout overrides (px). Fields left unspecified fall
   * back to their default. Sequence diagrams only.
   */
  sequence?: {
    /** Vertical space per message row. Default: 40 */
    messageRowHeight?: number
    /** Vertical space between actor boxes and the first message. Default: 20 */
    headerGap?: number
    /** Actor box height. Default: 40 */
    actorHeight?: number
    /** Gap between a message arrow and a note positioned directly after it. Default: 8 */
    noteOffsetAfterMessage?: number
    /** Gap between consecutively stacked notes. Default: 4 */
    noteStackGap?: number
  }

  /**
   * Opt-in ELK layout cache (see `createLayoutCache()`). When set,
   * `layoutGraphSync()` / `layoutClassDiagramSync()` / `layoutErDiagramSync()`
   * (flowchart/state, class, and ER diagrams — the ELK-based layout
   * engines) skip re-running ELK layout on a cache hit, keyed on a
   * deterministic serialization of the fully-resolved ELK input graph
   * (diagram structure + every layout-affecting option already baked in).
   *
   * Unset (the default) preserves the original always-recompute behavior
   * exactly — this cache is entirely opt-in. Create one instance and
   * reuse it across renders (e.g. module scope, or a `useRef` in React);
   * passing a freshly-created cache on every call defeats the point,
   * since it starts empty each time.
   */
  layoutCache?: LayoutCache
}

// ============================================================================
// Per-diagram-type option subsets — issue #534
//
// `RenderOptions` above is one flat interface consumed by all five diagram
// types (flowchart, sequence, class, ER, xychart — see `DiagramType` in
// packages/core/src/diagram-type.ts; state diagrams share the flowchart pipeline and so
// share `FlowchartRenderOptions`), but most fields apply to only a subset.
// Historically that applicability was discoverable only via the prose
// comments above — passing `curve` to an ER render was silently ignored,
// never rejected.
//
// These `Pick<RenderOptions, ...>` types make each diagram type's actual
// option surface structural rather than prose-only, confirmed field-by-field
// against real consumption (grepped across packages/svg-renderer/src/renderer.ts,
// src/sequence/renderer.ts, src/class/renderer.ts, src/er/renderer.ts,
// src/xychart/renderer.ts, and the layout modules each render path calls
// through — packages/svg-renderer/src/layout-engine.ts, src/sequence/layout.ts,
// src/class/layout.ts, src/er/layout.ts, src/xychart/layout.ts).
//
// IMPORTANT — this does not narrow `renderMermaidSVG(text, options)` itself.
// That entry point detects the diagram type from `text` *inside* the
// function, so the type checker cannot know which per-type subset applies
// at the call site — `options` there necessarily stays the full flat
// `RenderOptions` for backwards compatibility. These types exist for:
//   (a) callers who already know their diagram type and want the narrower,
//       self-documenting shape for a local variable or helper signature,
//       and
//   (b) internal module signatures (the `layout*Sync`/`layoutXYChart`
//       functions) that used to accept the full `RenderOptions` and
//       cherry-pick a handful of fields — now typed to only the fields that
//       diagram type actually reads.
// A structural, compile-time-enforced union at the `renderMermaidSVG` call
// site itself would need a breaking API change (see the design doc from
// issue #534's scoping pass) and is out of scope here.
// ============================================================================

/**
 * Options every diagram type honors: theming (colors, font), the shared
 * strict-CSP/accessibility/output controls, and the post-render
 * `resolveColors` pass. Every other `RenderOptions` field applies to only a
 * subset of diagram types — see the per-type types below.
 */
export type CommonRenderOptions = Pick<
  RenderOptions,
  | 'bg'
  | 'fg'
  | 'line'
  | 'accent'
  | 'muted'
  | 'surface'
  | 'border'
  | 'font'
  | 'transparent'
  | 'embedSource'
  | 'resolveColors'
  | 'nonce'
  | 'styleAttribute'
  | 'title'
  | 'decorative'
>

// Same as the `MIX` JSDoc above: the two `src/…` paths below keep their
// pre-#625 spelling (they are now under packages/svg-renderer/src/)
// because this comment ships verbatim in `dist/index.d.ts`, whose
// byte-identity is what verifies the move.
/**
 * Options applicable to flowchart (`graph` / `flowchart`) and state
 * (`stateDiagram-v2`) diagrams — both share `DiagramType: 'flowchart'` and
 * the same layout/render pipeline (src/layout-engine.ts, src/renderer.ts),
 * so they share one option shape. `componentSpacing` is currently a no-op
 * everywhere (accepted for forward compatibility only) but grouped here
 * since it's spacing-shaped like `padding`/`nodeSpacing`/`layerSpacing`.
 */
export type FlowchartRenderOptions = CommonRenderOptions &
  Pick<
    RenderOptions,
    | 'padding'
    | 'nodeSpacing'
    | 'layerSpacing'
    | 'componentSpacing'
    | 'mergeEdges'
    | 'direction'
    | 'curve'
    | 'fontSizes'
    | 'interactivity'
    | 'layoutCache'
  >

/**
 * Options applicable to sequence diagrams (`sequenceDiagram`). Sequence
 * diagrams ignore `direction`, `curve`, spacing/`layoutCache` (a
 * non-ELK layout), and `interactivity` (no animated edges or `click` links
 * in this renderer's sequence support).
 */
export type SequenceRenderOptions = CommonRenderOptions &
  Pick<RenderOptions, 'fontSizes' | 'sequence'>

/**
 * Options applicable to class diagrams (`classDiagram`). Class diagrams use
 * fixed internal padding/spacing (not `padding`/`nodeSpacing`/
 * `layerSpacing`) and have no `direction` or `curve` concept; `interactivity`
 * gates `click`-based links only — there's no edge-animation concept to gate.
 */
export type ClassRenderOptions = CommonRenderOptions &
  Pick<RenderOptions, 'fontSizes' | 'interactivity' | 'layoutCache'>

/**
 * Options applicable to ER diagrams (`erDiagram`). ER diagrams use fixed
 * internal padding/spacing and ignore `curve` and `interactivity` (no
 * animated edges or `click` links in this renderer's ER support), but do
 * honor `direction` (applied before layout via `withDirectionOverride`).
 */
export type ErRenderOptions = CommonRenderOptions &
  Pick<RenderOptions, 'direction' | 'fontSizes' | 'layoutCache'>

/**
 * Options applicable to XY charts (`xychart-beta`). XY charts have no
 * spacing/`direction`/`curve`/`fontSizes`/`layoutCache` concept (layout is
 * a fixed pixel computation, not ELK-based); `interactivity` (preferred) and
 * the deprecated `interactive` boolean both gate hover tooltips only.
 */
export type XyChartRenderOptions = CommonRenderOptions &
  Pick<RenderOptions, 'interactivity' | 'interactive'>
