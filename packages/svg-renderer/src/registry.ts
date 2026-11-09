// ============================================================================
// zombie-mermaid — SVG diagram-type registry
//
// A per-type registration table `renderMermaidSVG` (./index.ts) looks up
// instead of hand-maintaining its own `switch (diagramType)` over the same
// `DiagramType`. Moved here from the umbrella's `src/diagram-registry.ts`
// under issue #1111, for parity with `@zombie-mermaid/ascii-renderer`'s own
// `registry.ts` — see docs/decisions/diagram-type-registry-partial.md for
// why the SVG and ASCII halves stayed two separate tables rather than one
// shared `DiagramModule` with both a `renderSvg` and a `renderAscii` method
// (short version: one table made this module import out of
// `packages/ascii-renderer/`, while that package's `index.ts` imported this
// one back, a cycle that blocked the monorepo split and dragged `elkjs`
// into `dist/ascii.js`).
//
// Every diagram type is registered here, including 'flowchart' — see the
// decision doc for why it was the last holdout (its ASCII path had no
// per-type wrapper function to slot in until #745 extracted
// `renderFlowchartAscii`, and its SVG path carries `%%{init: ...}%%`
// directive handling no other type has — see `flowchartModule.layoutForSvg`
// below for how that's folded in without growing `SvgRenderContext`). The
// front door (`renderMermaidSVG` in ./index.ts) has no fallback switch left;
// every `DiagramType` is a hit here.
//
// `packages/core/src/diagram-type.ts` (the `DiagramType` union + `detectDiagramType`)
// stays exactly as-is and is what the front door uses to key into this
// table — this module doesn't touch detection.
//
// `parseMermaid` (flowchart/state parsing) reaches out to the umbrella's
// `../../../src/parser.ts` rather than a `@zombie-mermaid/*` package
// specifier — flowchart/state parsing was deliberately never extracted into
// `@zombie-mermaid/mermaid-parser` (see that package's scoping doc), the same
// pre-existing boundary call `packages/ascii-renderer/src/flowchart.ts`
// already reaches across for the ASCII side. `vite.config.ts` bundles that
// file straight into this package's own dist, exactly as it already does
// for `ascii-renderer` — see that file's header comment.
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
import type { FontSizes } from './styles.ts'
import { extractInitConfig, withDirectionOverride } from '@zombie-mermaid/core'

import {
  parseXYChart,
  parseErDiagram,
  parseSequenceDiagram,
  parseClassDiagram,
  parseArchitecture,
  architectureToGraph,
  parseC4Diagram,
  parsePieChart,
  parseMindmap,
  parseQuadrantChart,
  parseGantt,
  parseTimeline,
  parseGitGraph,
  parseJourney,
  parseKanban,
  parseRequirementDiagram,
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
  ArchitectureDiagram,
  C4Diagram,
  PositionedC4Diagram,
  PieChart,
  PositionedPieChart,
  QuadrantChart,
  PositionedQuadrantChart,
  Mindmap,
  PositionedMindmap,
  GanttChart,
  PositionedGanttChart,
  Timeline,
  PositionedTimeline,
  GitGraph,
  PositionedGitGraph,
  Journey,
  PositionedJourney,
  Kanban,
  PositionedKanban,
  RequirementDiagram,
  PositionedRequirementDiagram,
} from '@zombie-mermaid/mermaid-parser'
import { layoutXYChart } from './xychart/layout.ts'
import { renderXYChartSvg } from './xychart/renderer.ts'
import { layoutErDiagramSync } from './er/layout.ts'
import { renderErSvg } from './er/renderer.ts'
import { layoutSequenceDiagram } from './sequence/layout.ts'
import { renderSequenceSvg } from './sequence/renderer.ts'
import { layoutClassDiagramSync } from './class/layout.ts'
import { renderClassSvg } from './class/renderer.ts'
import { layoutC4DiagramSync } from './c4/layout.ts'
import { renderC4Svg } from './c4/renderer.ts'
import { layoutPieChart } from './pie/layout.ts'
import { renderPieSvg } from './pie/renderer.ts'
import { layoutQuadrantChart } from './quadrant/layout.ts'
import { renderQuadrantSvg } from './quadrant/renderer.ts'
import { layoutMindmap } from './mindmap/layout.ts'
import { renderMindmapSvg } from './mindmap/renderer.ts'
import { layoutGantt } from './gantt/layout.ts'
import { renderGanttSvg } from './gantt/renderer.ts'
import { layoutTimeline } from './timeline/layout.ts'
import { layoutJourney } from './journey/layout.ts'
import { renderJourneySvg } from './journey/renderer.ts'
import { renderTimelineSvg } from './timeline/renderer.ts'
import { layoutGitGraph } from './gitgraph/layout.ts'
import { renderGitGraphSvg } from './gitgraph/renderer.ts'
import { layoutKanban } from './kanban/layout.ts'
import { renderKanbanSvg } from './kanban/renderer.ts'
import { layoutRequirementDiagramSync } from './requirement/layout.ts'
import { renderRequirementSvg } from './requirement/renderer.ts'
import { layoutFlowchartSync } from './layout-engine.ts'
import { layoutArchitectureGrid } from './layout-engine/architecture-grid.ts'
import { renderSvg as renderFlowchartSvg } from './renderer.ts'
import { parseMermaid } from '@zombie-mermaid/mermaid-parser'

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
 * as each existing `renderMermaidSVGRaw` switch case already did.
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
 * unrelated grid/canvas layout internally — see e.g.
 * `packages/ascii-renderer/src/xychart.ts`'s file header: "Uses the parsed
 * XYChart type directly (not PositionedXYChart) since pixel coordinates
 * don't map to character grids." `parse` genuinely is shared in the sense
 * that both front doors call the same `parseXYChart`/`parseErDiagram`, but
 * each ASCII renderer reruns that parse itself from raw text — which is why
 * the ASCII entries live in `packages/ascii-renderer/src/registry.ts` as
 * plain `(text, …) => string` functions instead of a `renderAscii` method on
 * this interface.
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
    // Mirrors resolveXYChartInteractive() in the umbrella's src/index.ts
    // exactly — `interactivity` wins when set, otherwise the deprecated
    // `interactive` boolean keeps controlling this as before.
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
 * Mirrors `resolveLinksEnabled()` in the umbrella's src/index.ts exactly
 * (`interactivity` defaults unset to `'static'`; only `'none'` turns links
 * off) — duplicated here rather than imported since that helper is private
 * to src/index.ts, which now imports this module (importing it back would
 * cycle).
 */
function resolveLinksEnabled(options: RenderOptions): boolean {
  const interactivity = options.interactivity ?? 'static'
  return interactivity !== 'none'
}

/**
 * Mirrors `resolveAnimationEnabled()` in the umbrella's src/index.ts exactly
 * (`interactivity` defaults unset to `'static'`; only `'full'` turns
 * animation on) — duplicated here for the same import-direction reason
 * `resolveLinksEnabled` above is.
 */
function resolveAnimationEnabled(options: RenderOptions): boolean {
  const interactivity = options.interactivity ?? 'static'
  return interactivity === 'full'
}

const classModule: DiagramModule<ClassDiagram, PositionedClassDiagram> = {
  type: 'class',
  parse(lines, text) {
    const layout = extractInitConfig(text.split(/\r\n?|\n/)).classLayout
    return { ...parseClassDiagram(lines), ...(layout && { layout }) }
  },
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
  parse(lines, text) {
    const layout = extractInitConfig(text.split(/\r\n?|\n/)).erLayout
    return { ...parseErDiagram(lines), ...(layout && { layout }) }
  },
  // `options.direction` replaces the diagram's own top-level `direction`
  // line, if any, before layout — same order as the umbrella's original
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
 * see `applyInitConfig()` in `packages/core/src/init-directive.ts`, which
 * the umbrella's pre-registry flowchart path used to call directly.
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
    // Same order as the umbrella's original fallback: direction override,
    // then layout. The curve is the `options.curve` render option or
    // 'linear'; `flowchart.curve` in an init directive is ignored, as in
    // mermaid 12.3.0 (#2729).
    const graph = withDirectionOverride(diagram, options.direction)
    return {
      graph: layoutFlowchartSync(graph, options),
      curve: options.curve ?? 'linear',
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

const c4Module: DiagramModule<C4Diagram, PositionedC4Diagram> = {
  type: 'c4',
  parse: parseC4Diagram,
  // Mermaid's C4 renderer has no direction: shapes are placed in rows in
  // declaration order, so `options.direction` does not apply to the SVG.
  layoutForSvg(diagram, options) {
    return layoutC4DiagramSync(diagram, options)
  },
  renderSvg(positioned, ctx) {
    return renderC4Svg(
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
 * Architecture diagrams are lowered to the flowchart model
 * (`architectureToGraph` in `@zombie-mermaid/mermaid-parser`) and ride the
 * flowchart layout + renderer, so this module is `flowchartModule` with a
 * different `parse`. Mermaid's architecture edges are straight runs and
 * elbows whatever `flowchart.curve` or the caller says (measured against
 * mermaid@12.3.0, #2632), so `curve` is always 'linear'.
 */
const architectureModule: DiagramModule<
  ArchitectureDiagram,
  PositionedFlowchart
> = {
  type: 'architecture',
  parse: parseArchitecture,
  layoutForSvg(diagram, options) {
    const graph = withDirectionOverride(
      architectureToGraph(diagram),
      options.direction,
    )
    return {
      graph: layoutArchitectureGrid(graph, options.padding),
      curve: 'linear',
    }
  },
  renderSvg: flowchartModule.renderSvg,
}

/**
 * Pie charts parse from the raw `text` rather than `lines` (see
 * `parsePieChart`'s doc: `splitStatements` would split `title A; B` and
 * treat `'` as a quote), then lay out and render to Mermaid's geometry —
 * see ./pie/layout.ts. No direction or interactivity applies.
 */
const pieModule: DiagramModule<PieChart, PositionedPieChart> = {
  type: 'pie',
  parse: (_lines, text) => parsePieChart(text),
  // `pie1..pie12` from the directive only when the caller opted in.
  layoutForSvg: (chart, options) =>
    layoutPieChart(
      options.honorThemeVariables
        ? chart
        : { ...chart, sliceColors: undefined },
      options,
    ),
  renderSvg(positioned, ctx) {
    return renderPieSvg(
      positioned,
      ctx.colors,
      ctx.font,
      ctx.transparent,
      ctx.embedSource,
      ctx.title,
      ctx.decorative,
      ctx.emit,
    )
  },
}

/**
 * Quadrant charts parse from the raw `text` (Mermaid's grammar has no `;`
 * statement separator and a label may contain one), then lay out to
 * Mermaid's geometry (500 x 500 unless the `quadrantChart` init config says
 * otherwise). No direction or interactivity applies.
 */
const quadrantModule: DiagramModule<QuadrantChart, PositionedQuadrantChart> = {
  type: 'quadrant',
  parse: (_lines, text) => parseQuadrantChart(text),
  // `quadrant*` colours from the directive only when the caller opted in;
  // the `quadrantChart` sizes always apply, as Mermaid's config does.
  layoutForSvg: (chart, options) =>
    layoutQuadrantChart(
      options.honorThemeVariables
        ? chart
        : { ...chart, themeColors: undefined },
    ),
  renderSvg(positioned, ctx) {
    return renderQuadrantSvg(
      positioned,
      ctx.colors,
      ctx.font,
      ctx.transparent,
      ctx.embedSource,
      ctx.title,
      ctx.decorative,
      ctx.emit,
    )
  },
}

/**
 * Mindmaps parse from the raw `text` (the grammar is indentation based and a
 * label may contain `;`), then lay out with Mermaid's CoSE-Bilkent force
 * layout. No direction or interactivity applies.
 */
const mindmapModule: DiagramModule<Mindmap, PositionedMindmap> = {
  type: 'mindmap',
  parse: (_lines, text) => parseMindmap(text),
  layoutForSvg: (chart) => layoutMindmap(chart),
  renderSvg(positioned, ctx) {
    return renderMindmapSvg(
      positioned,
      ctx.colors,
      ctx.font,
      ctx.transparent,
      ctx.embedSource,
      ctx.title,
      ctx.decorative,
      ctx.emit,
    )
  },
}

/**
 * Gantt charts parse from the raw `text` (a task line is `name :data`, which
 * the statement splitter would cut at `;` and `#`) and lay out at Mermaid's
 * fallback width. The `todayMarker` line only appears while today is inside
 * the chart's date range.
 */
const ganttModule: DiagramModule<GanttChart, PositionedGanttChart> = {
  type: 'gantt',
  parse: (_lines, text) => parseGantt(text),
  layoutForSvg: (chart) => layoutGantt(chart),
  renderSvg(positioned, ctx) {
    return renderGanttSvg(
      positioned,
      ctx.colors,
      ctx.font,
      ctx.transparent,
      ctx.embedSource,
      ctx.title,
      ctx.decorative,
      ctx.emit,
    )
  },
}

/** Journeys parse from the raw `text` (`;` is not a separator there), then lay out to Mermaid's fixed geometry. */
const journeyModule: DiagramModule<Journey, PositionedJourney> = {
  type: 'journey',
  parse: (_lines, text) => parseJourney(text),
  layoutForSvg: (j) => layoutJourney(j),
  renderSvg(positioned, ctx) {
    return renderJourneySvg(
      positioned,
      ctx.colors,
      ctx.font,
      ctx.transparent,
      ctx.embedSource,
      ctx.title,
      ctx.decorative,
      ctx.emit,
    )
  },
}

/**
 * Timelines parse from the raw `text` (Mermaid's lexer has no `;` statement
 * separator and a label may contain one), then lay out to Mermaid's fixed
 * geometry. No theme variables or interactivity apply.
 */
const timelineModule: DiagramModule<Timeline, PositionedTimeline> = {
  type: 'timeline',
  parse: (_lines, text) => parseTimeline(text),
  layoutForSvg: (tl) => layoutTimeline(tl),
  renderSvg(positioned, ctx) {
    return renderTimelineSvg(
      positioned,
      ctx.colors,
      ctx.font,
      ctx.transparent,
      ctx.embedSource,
      ctx.title,
      ctx.decorative,
      ctx.emit,
    )
  },
}

/** Kanban boards parse from the raw `text`, then lay out to Mermaid's fixed geometry. */
const kanbanModule: DiagramModule<Kanban, PositionedKanban> = {
  type: 'kanban',
  parse: (_lines, text) => parseKanban(text),
  layoutForSvg: (kb) => layoutKanban(kb),
  renderSvg(positioned, ctx) {
    return renderKanbanSvg(
      positioned,
      ctx.colors,
      ctx.font,
      ctx.transparent,
      ctx.embedSource,
      ctx.title,
      ctx.decorative,
      ctx.emit,
    )
  },
}

/**
 * Requirement diagrams parse from the raw `text` (a value may hold `;` or
 * `'`), then lay out with ELK like ER. `options.direction` replaces the
 * diagram's own `direction` statement.
 */
const requirementModule: DiagramModule<
  RequirementDiagram,
  PositionedRequirementDiagram
> = {
  type: 'requirement',
  parse: (_lines, text) => parseRequirementDiagram(text),
  layoutForSvg: (diagram, options) =>
    layoutRequirementDiagramSync(diagram, options),
  renderSvg(positioned, ctx) {
    return renderRequirementSvg(
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
 * GitGraphs parse from the raw `text` (Mermaid's lexer has no `;` statement
 * separator), then lay out with Mermaid's own constants. Colours are this
 * library's palette; no interactivity applies.
 */
const gitgraphModule: DiagramModule<GitGraph, PositionedGitGraph> = {
  type: 'gitgraph',
  parse: (_lines, text) => parseGitGraph(text),
  layoutForSvg: (gg) => layoutGitGraph(gg),
  renderSvg(positioned, ctx) {
    return renderGitGraphSvg(
      positioned,
      ctx.colors,
      ctx.font,
      ctx.transparent,
      ctx.embedSource,
      ctx.title,
      ctx.decorative,
      ctx.emit,
    )
  },
}

/**
 * The registry proper — every `DiagramType` is looked up here by the SVG
 * front door (`renderMermaidSVG` in ./index.ts), which has no fallback
 * switch left. The ASCII front door's equivalent table is `asciiRegistry`
 * in `packages/ascii-renderer/src/registry.ts`.
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
  architecture: architectureModule,

  c4: c4Module,
  pie: pieModule,
  quadrant: quadrantModule,
  mindmap: mindmapModule,
  gantt: ganttModule,
  timeline: timelineModule,
  journey: journeyModule,
  kanban: kanbanModule,
  requirement: requirementModule,
  gitgraph: gitgraphModule,
}
