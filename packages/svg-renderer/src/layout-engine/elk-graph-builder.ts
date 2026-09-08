/**
 * Shared ELK graph-*construction* helpers.
 *
 * The reverse direction (reading geometry back out of an ELK result) lives
 * in `./elk-adapter-utils.ts`; this module is its input-side counterpart.
 *
 * Three renderers build ELK's typed JSON input independently —
 * `./to-elk.ts` (flowchart + state), `src/class/layout.ts`, and
 * `src/er/layout.ts`. They differ in domain model and in which extra
 * `elk.*` options they set, but the primitives underneath are identical:
 * one direction mapping, one `elk.padding` string format, one leaf-node
 * shape, and one measured edge-label box. Those primitives live here so
 * the three call sites can't drift (issue #616).
 *
 * This module deliberately does **not** try to abstract over the three
 * diagram types' own graph shapes (subgraph nesting, hierarchical ports,
 * note links) — that would be an engine-neutral intermediate graph, which
 * is the separately-scoped work in #538.
 */

import type { ElkExtendedEdge, ElkLabel, ElkNode, LayoutOptions } from 'elkjs'
import type { Direction } from '@zombie-mermaid/core'
import { measureMultilineText } from '@zombie-mermaid/core'
import { FONT_WEIGHTS } from '../styles.ts'

// ============================================================================
// Direction
// ============================================================================

/** The four values ELK's `elk.direction` option accepts in this codebase. */
export type ElkDirection = 'DOWN' | 'UP' | 'LEFT' | 'RIGHT'

/**
 * The `elk.direction` each diagram type falls back to when its source
 * carries no `direction` statement.
 *
 * These genuinely differ per diagram type, and the difference is
 * intentional rather than an accident of three separate implementations:
 *
 * - **flowchart / state** — `DOWN`. `MermaidGraph.direction` is a required
 *   field the parser always fills in (defaulting to `TD`), so the fallback
 *   is only a type-level backstop; the effective default is mermaid's own
 *   top-down flowchart default.
 * - **class** — `DOWN`. `ClassDiagram` has no direction concept at all (see
 *   `ClassRenderOptions` in `src/types.ts`: class diagrams "have no
 *   `direction` or `curve` concept"), so this is the renderer's single
 *   fixed orientation, matching Mermaid's own TB class rendering — which
 *   `src/class/layout.ts` relies on to put a `note for X` above its class.
 * - **ER** — `RIGHT`. An ER diagram's `direction` is optional
 *   (`ErDiagram.direction?`), left `undefined` when the source has no
 *   `direction` statement, and this renderer has always laid those out
 *   left-to-right. `direction TB`/`LR`/`BT`/`RL` in the source (or
 *   `RenderOptions.direction`, applied via `withDirectionOverride`) still
 *   wins over it.
 *
 * The *mappings* were never in conflict — both hand-rolled
 * `directionToElk()` implementations agreed on all five `Direction` values
 * (`LR`→`RIGHT`, `RL`→`LEFT`, `BT`→`UP`, `TD`/`TB`→`DOWN`). Only the
 * no-direction fallback differed, which is why it is a parameter here
 * rather than something to reconcile away.
 */
export const ELK_DIRECTION_FALLBACK = {
  flowchart: 'DOWN',
  state: 'DOWN',
  class: 'DOWN',
  er: 'RIGHT',
} as const satisfies Record<string, ElkDirection>

/**
 * Convert a Mermaid `direction` to ELK's `elk.direction` value.
 *
 * `fallback` covers the no-`direction`-statement case only — every member
 * of `Direction` has an explicit mapping. Pass the diagram type's entry
 * from `ELK_DIRECTION_FALLBACK` rather than a bare string literal, so the
 * per-type defaults stay documented in one place.
 */
export function directionToElk(
  dir: Direction | undefined,
  fallback: ElkDirection,
): ElkDirection {
  switch (dir) {
    case 'LR':
      return 'RIGHT'
    case 'RL':
      return 'LEFT'
    case 'BT':
      return 'UP'
    case 'TD':
    case 'TB':
      return 'DOWN'
    default:
      return fallback
  }
}

// ============================================================================
// Layout options
// ============================================================================

/** Per-side padding, for the asymmetric case (a subgraph's header gap). */
export interface ElkPaddingSides {
  top: number
  left: number
  bottom: number
  right: number
}

/**
 * Format ELK's `elk.padding` value. A single number applies to all four
 * sides; an object sets them individually.
 */
export function elkPadding(padding: number | ElkPaddingSides): string {
  const sides: ElkPaddingSides =
    typeof padding === 'number'
      ? { top: padding, left: padding, bottom: padding, right: padding }
      : padding
  return `[top=${sides.top},left=${sides.left},bottom=${sides.bottom},right=${sides.right}]`
}

/**
 * The `elk.*` options every one of the three graph builders sets, with the
 * values they all agree on. Callers spread the result and add their own
 * diagram-specific options on top.
 */
export function baseElkLayoutOptions(spec: {
  direction: ElkDirection
  nodeSpacing: number
  layerSpacing: number
  padding: number | ElkPaddingSides
}): LayoutOptions {
  return {
    'elk.algorithm': 'layered',
    'elk.direction': spec.direction,
    'elk.spacing.nodeNode': String(spec.nodeSpacing),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(spec.layerSpacing),
    'elk.padding': elkPadding(spec.padding),
    'elk.edgeRouting': 'ORTHOGONAL',
  }
}

// ============================================================================
// Nodes
// ============================================================================

/**
 * Build a leaf ELK node.
 *
 * `label` is attached as an ELK label when supplied — the flowchart/state
 * path does that (ELK reads it for nothing, but `from-elk.ts` reads it
 * back); class and ER carry labels in their own side tables instead and
 * omit it. An empty-string label is still a label, so the check is
 * `undefined`, not truthiness.
 */
export function buildElkLeafNode(
  id: string,
  size: { width: number; height: number },
  label?: string,
): ElkNode {
  const node: ElkNode = { id, width: size.width, height: size.height }
  if (label !== undefined) node.labels = [{ text: label }]
  return node
}

// ============================================================================
// Edges
// ============================================================================

/**
 * Per-label layout options the flowchart/state path sets on every edge
 * label. Class and ER instead set `elk.edgeLabels.placement` once on the
 * root graph, so they pass no per-label options.
 */
export const INLINE_CENTERED_EDGE_LABEL: LayoutOptions = {
  'elk.edgeLabels.inline': 'true',
  'elk.edgeLabels.placement': 'CENTER',
}

/**
 * How a caller wants its edge labels measured and placed. `fontSize` is
 * the resolved `fontSizes.edgeLabel`; `layoutOptions`, when given, is
 * attached to the ELK label itself.
 */
export interface ElkEdgeLabelStyle {
  fontSize: number
  layoutOptions?: LayoutOptions
}

/**
 * Measure an edge label and build ELK's label box for it.
 *
 * The `+8` / `+6` are the horizontal/vertical breathing room all three
 * builders have always added around the measured text so ELK reserves a
 * slightly larger channel than the glyphs strictly need.
 */
export function buildElkEdgeLabel(
  text: string,
  style: ElkEdgeLabelStyle,
): ElkLabel {
  const metrics = measureMultilineText(
    text,
    style.fontSize,
    FONT_WEIGHTS.edgeLabel,
  )
  const label: ElkLabel = {
    text,
    width: metrics.width + 8,
    height: metrics.height + 6,
  }
  // Copied, not aliased: every label previously got its own fresh options
  // literal, and ELK receives this graph by reference (see
  // `elkLayoutSync`'s `saveDispatch`) rather than through a structured
  // clone — so a shared object would be shared into ELK's own hands too.
  if (style.layoutOptions) label.layoutOptions = { ...style.layoutOptions }
  return label
}

/**
 * Build a single-source/single-target ELK edge, with a measured label when
 * `label` is non-empty. An absent or empty label leaves `labels` off the
 * edge entirely (rather than setting it to an empty array or `undefined`),
 * matching what all three builders did by hand.
 */
export function buildElkEdge(spec: {
  id: string
  source: string
  target: string
  label?: string
  labelStyle: ElkEdgeLabelStyle
}): ElkExtendedEdge {
  const edge: ElkExtendedEdge = {
    id: spec.id,
    sources: [spec.source],
    targets: [spec.target],
  }
  if (spec.label) {
    edge.labels = [buildElkEdgeLabel(spec.label, spec.labelStyle)]
  }
  return edge
}
