// ============================================================================
// zombie-mermaid — SVG diagram-type registry (partial; see issue #533)
//
// A per-type registration table `renderMermaidSVGRaw` (src/index.ts) looks
// up instead of hand-maintaining its own `switch (diagramType)` over the
// same `DiagramType`. The ASCII front door has the matching table of its
// own in src/ascii/registry.ts — see that file's header for why the two
// halves are separate modules rather than one shared `DiagramModule` with
// both a `renderSvg` and a `renderAscii` method (short version: one table
// made this module import out of src/ascii/ while src/ascii/index.ts
// imported back out of here, a cycle that blocks the monorepo split and
// already dragged `elkjs` into `dist/ascii.js`).
//
// Every diagram type is registered here, including 'flowchart' — see
// docs/decisions/diagram-type-registry-partial.md for why it was the last
// holdout (its ASCII path had no per-type wrapper function to slot in until
// #745 extracted `renderFlowchartAscii`, and its SVG path carries
// `%%{init: ...}%%` directive handling no other type has — see
// `flowchartModule.layoutForSvg` below for how that's folded in without
// growing `SvgRenderContext`). The front door (`renderMermaidSVGRaw` in
// src/index.ts) has no fallback switch left; every `DiagramType` is a hit
// here.
//
// `packages/core/src/diagram-type.ts` (the `DiagramType` union + `detectDiagramType`)
// stays exactly as-is and is what the front doors use to key into this
// table — this module doesn't touch detection.
// ============================================================================

import type {
  DiagramType,
  RenderOptions,
  DiagramColors,
  SvgEmitOptions,
  MermaidGraph,
  PositionedGraph,
  CurveStyle,
  Statement,
} from '@zombie-mermaid/core'
import type { FontSizes } from '@zombie-mermaid/svg-renderer'
import { withDirectionOverride } from '@zombie-mermaid/core'

import {
  parseXYChart,
  parseErDiagram,
  parseSequenceDiagram,
  parseClassDiagram,
} from '@zombie-mermaid/mermaid-parser'
import type {
  XYChart,
  PositionedXYChart,
  ErDiagram,
  PositionedErDiagram,
  SequenceDiagram,
  PositionedSequenceDiagram,
  ClassDiagram,
  PositionedClassDiagram,
} from '@zombie-mermaid/mermaid-parser'
import {
  layoutXYChart,
  renderXYChartSvg,
  layoutErDiagramSync,
  renderErSvg,
  layoutSequenceDiagram,
  renderSequenceSvg,
  layoutClassDiagramSync,
  renderClassSvg,
  layoutGraphSync,
  renderSvg as renderFlowchartSvg,
} from '@zombie-mermaid/svg-renderer'
import { parseMermaid } from './parser.ts'

/**
 * Parameters shared by every per-type SVG renderer today, factored out of
 * the positional-argument lists that otherwise differ type to type (the
 * inconsistency issue #533 flags — confirmed by reading all five renderer
 * signatures: `embedSource`/`title`/`decorative`/`emit` shift position
 * across `renderSvg`, `renderSequenceSvg`, `renderClassSvg`, `renderErSvg`,
 * `renderXYChartSvg`, and `renderErSvg` drops `linksEnabled` entirely).
 *
 * Fields only one or two types need (`curve`, `animationEnabled`,
 * `linksEnabled`, `interactive`) are deliberately left OUT of this shared
 * shape rather than grown in for every exception — each type's own
 * `renderSvg` adapter below derives those straight from `options`, exactly
 * as each existing `renderMermaidSVGRaw` switch case already does today.
 */
export interface SvgRenderContext {
  colors: DiagramColors
  font: string
  transparent: boolean
  fontSizes: FontSizes
  embedSource?: string
  title?: string
  decorative?: boolean
  emit: SvgEmitOptions
}

/**
 * One diagram type's full registration.
 *
 * `layoutForSvg` is deliberately SVG-only — it is NOT shared with the ASCII
 * side, unlike the issue's original `{ detect, parse, layout, renderSvg,
 * renderAscii }` sketch. Reading every ASCII per-type module confirmed why a
 * single shared `layout` step would be fiction, not simplification, for this
 * codebase: SVG layout produces pixel coordinates (`PositionedXYChart`,
 * `PositionedErDiagram`, …), while every ASCII renderer does its own,
 * unrelated grid/canvas layout internally — see e.g. src/ascii/xychart.ts's
 * file header: "Uses the parsed XYChart type directly (not
 * PositionedXYChart) since pixel coordinates don't map to character grids."
 * `parse` genuinely is shared in the sense that both front doors call the
 * same `parseXYChart`/`parseErDiagram`, but each ASCII renderer reruns that
 * parse itself from raw text — which is why the ASCII entries live in
 * src/ascii/registry.ts as plain `(text, …) => string` functions instead of
 * a `renderAscii` method on this interface.
 *
 * `parse` takes both `lines` (the pre-split statement list from
 * `splitStatements(decoded)`, computed once by the front door — what every
 * already-registered type's parser wants) and `text` (the raw, un-split
 * source `flowchartModule` below needs instead): `parseMermaid`'s
 * `%%{init: ...}%%` directive extraction reads raw, un-commented lines that
 * `splitStatements` has already discarded by the time `lines` exists, and
 * its multi-line-statement continuation merging needs each statement's
 * *originating physical line* grouping, which `splitStatements`'s flattened
 * array has already lost. `xychartModule`/`erModule`/`sequenceModule`/
 * `classModule` all ignore the second parameter — JS/TS functions may take
 * fewer parameters than their declared type allows, so `parse: parseXYChart`
 * (etc.) is unchanged from before this parameter was added.
 */
export interface DiagramModule<TDiagram = unknown, TPositioned = unknown> {
  readonly type: DiagramType
  parse(lines: Statement[], text: string): TDiagram
  layoutForSvg(diagram: TDiagram, options: RenderOptions): TPositioned
  renderSvg(
    positioned: TPositioned,
    ctx: SvgRenderContext,
    options: RenderOptions,
  ): string
}

const xychartModule: DiagramModule<XYChart, PositionedXYChart> = {
  type: 'xychart',
  parse: parseXYChart,
  layoutForSvg: layoutXYChart,
  renderSvg(positioned, ctx, options) {
    // Mirrors resolveXYChartInteractive() in src/index.ts exactly —
    // `interactivity` wins when set, otherwise the deprecated `interactive`
    // boolean keeps controlling this as before.
    const interactive =
      options.interactivity !== undefined
        ? options.interactivity === 'full'
        : (options.interactive ?? false)
    return renderXYChartSvg(
      positioned,
      ctx.colors,
      ctx.font,
      ctx.transparent,
      interactive,
      ctx.embedSource,
      ctx.title,
      ctx.decorative,
      ctx.emit,
    )
  },
}

const sequenceModule: DiagramModule<
  SequenceDiagram,
  PositionedSequenceDiagram
> = {
  type: 'sequence',
  parse: parseSequenceDiagram,
  layoutForSvg: layoutSequenceDiagram,
  renderSvg(positioned, ctx) {
    return renderSequenceSvg(
      positioned,
      ctx.colors,
      ctx.font,
      ctx.transparent,
      ctx.fontSizes,
      ctx.embedSource,
      ctx.title,
      ctx.decorative,
      ctx.emit,
    )
  },
}

/**
 * Mirrors `resolveLinksEnabled()` in src/index.ts exactly (`interactivity`
 * defaults unset to `'static'`; only `'none'` turns links off) — duplicated
 * here rather than imported since that helper is private to src/index.ts and
 * this module is imported BY src/index.ts, so importing it back would cycle.
 */
function resolveLinksEnabled(options: RenderOptions): boolean {
  const interactivity = options.interactivity ?? 'static'
  return interactivity !== 'none'
}

/**
 * Mirrors `resolveAnimationEnabled()` in src/index.ts exactly (`interactivity`
 * defaults unset to `'static'`; only `'full'` turns animation on) — duplicated
 * here for the same import-direction reason `resolveLinksEnabled` above is.
 */
function resolveAnimationEnabled(options: RenderOptions): boolean {
  const interactivity = options.interactivity ?? 'static'
  return interactivity === 'full'
}

const classModule: DiagramModule<ClassDiagram, PositionedClassDiagram> = {
  type: 'class',
  parse: parseClassDiagram,
  layoutForSvg: layoutClassDiagramSync,
  renderSvg(positioned, ctx, options) {
    return renderClassSvg(
      positioned,
      ctx.colors,
      ctx.font,
      ctx.transparent,
      ctx.fontSizes,
      ctx.embedSource,
      ctx.title,
      ctx.decorative,
      resolveLinksEnabled(options),
      ctx.emit,
    )
  },
}

const erModule: DiagramModule<ErDiagram, PositionedErDiagram> = {
  type: 'er',
  parse: parseErDiagram,
  // `options.direction` replaces the diagram's own top-level `direction`
  // line, if any, before layout — same order as src/index.ts's original
  // 'er' case: parse, then withDirectionOverride, then layout.
  layoutForSvg(diagram, options) {
    return layoutErDiagramSync(
      withDirectionOverride(diagram, options.direction),
      options,
    )
  },
  renderSvg(positioned, ctx) {
    return renderErSvg(
      positioned,
      ctx.colors,
      ctx.font,
      ctx.transparent,
      ctx.fontSizes,
      ctx.embedSource,
      ctx.title,
      ctx.decorative,
      ctx.emit,
    )
  },
}

/**
 * `renderSvg`'s (the low-level flowchart/state SVG emitter, imported above
 * as `renderFlowchartSvg`) `curve` parameter is the one piece of
 * `SvgRenderContext`-adjacent state no other registered type needs: a
 * `%%{init: {"flowchart": {"curve": ...}}}%%` directive on the diagram
 * itself can supply a default, and `options.curve` always wins when set —
 * see `applyInitConfig()` in packages/core/src/init-directive.ts, which
 * `src/index.ts`'s pre-registry flowchart path used to call directly.
 *
 * That resolution needs the parsed diagram (for `initConfig`) AND the
 * caller's `options` together, and the *result* is only needed later, by
 * `renderSvg` — so rather than teach `SvgRenderContext` a diagram-specific
 * `curve` field (every other field there is genuinely shared across types),
 * `layoutForSvg` below resolves it once and carries it forward on
 * `PositionedFlowchart`, right next to the `PositionedGraph` it was
 * resolved alongside. `animationEnabled`/`linksEnabled` need no such
 * carry-through: both derive from `options` alone via the
 * `resolveAnimationEnabled`/`resolveLinksEnabled` helpers above, exactly
 * like `class`'s `linksEnabled` already does, so `flowchartModule.renderSvg`
 * just calls them directly.
 */
export interface PositionedFlowchart {
  graph: PositionedGraph
  curve: CurveStyle
}

const flowchartModule: DiagramModule<MermaidGraph, PositionedFlowchart> = {
  type: 'flowchart',
  // Ignores `lines` — see the `parse` doc comment on `DiagramModule` above
  // for why flowchart/state needs the raw `text` instead.
  parse: (_lines, text) => parseMermaid(text),
  layoutForSvg(diagram, options) {
    // Same order as src/index.ts's original fallback: direction override,
    // then layout. `options.curve` wins over the diagram's own
    // `%%{init: ...}%%` directive, which wins over the 'linear' default —
    // see the doc comment on `PositionedFlowchart` above.
    const graph = withDirectionOverride(diagram, options.direction)
    return {
      graph: layoutGraphSync(graph, options),
      curve: options.curve ?? diagram.initConfig?.curve ?? 'linear',
    }
  },
  renderSvg(positioned, ctx, options) {
    return renderFlowchartSvg(
      positioned.graph,
      ctx.colors,
      ctx.font,
      ctx.transparent,
      ctx.fontSizes,
      positioned.curve,
      ctx.embedSource,
      resolveAnimationEnabled(options),
      resolveLinksEnabled(options),
      ctx.title,
      ctx.decorative,
      ctx.emit,
    )
  },
}

/**
 * The registry proper — every `DiagramType` is looked up here by the SVG
 * front door (`renderMermaidSVGRaw` in src/index.ts), which has no
 * fallback switch left. The ASCII front door's equivalent table is
 * `asciiRegistry` in src/ascii/registry.ts.
 *
 * Typed with `any` type parameters at the map level: each entry's own
 * `TDiagram`/`TPositioned` are only known inside that entry's own closure
 * (see `xychartModule`/`erModule`/`flowchartModule` above, which are fully
 * typed); the map just needs one consistent shape to hold heterogeneous
 * entries in.
 */
type AnyDiagramModule = DiagramModule<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above; each entry is fully typed at its own definition site.
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above; each entry is fully typed at its own definition site.
  any
>

export const diagramRegistry: Record<DiagramType, AnyDiagramModule> = {
  xychart: xychartModule,
  er: erModule,
  sequence: sequenceModule,
  class: classModule,
  flowchart: flowchartModule,
}
