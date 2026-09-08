// ============================================================================
// zombie-mermaid — diagram-type registry (partial; see issue #533)
//
// A single per-type registration table that both front doors
// (`renderMermaidSVGRaw` in src/index.ts, `renderMermaidASCII` in
// src/ascii/index.ts) can look up instead of each hand-maintaining its own
// `switch (diagramType)` over the same `DiagramType`.
//
// Only 'xychart' and 'er' are registered here. Those two are the only
// diagram types whose existing renderer signatures adapt to a shared shape
// with zero behavior change — see the issue-533 scoping doc (in the PR/
// issue body) for why 'sequence', 'class', and 'flowchart' are NOT
// registered yet and what would need to change first. Both front doors
// check this table first; anything absent falls through to that front
// door's own switch, completely unchanged.
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
} from '@zombie-mermaid/core'
import type { FontSizes } from '@zombie-mermaid/svg-renderer'
import type { AsciiConfig, AsciiTheme, ColorMode } from './ascii/types.ts'
import { withDirectionOverride } from '@zombie-mermaid/core'

import { parseXYChart } from './xychart/parser.ts'
import { layoutXYChart } from './xychart/layout.ts'
import { renderXYChartSvg } from './xychart/renderer.ts'
import { renderXYChartAscii } from './ascii/xychart.ts'
import type { XYChart, PositionedXYChart } from './xychart/types.ts'

import { parseErDiagram } from './er/parser.ts'
import { layoutErDiagramSync } from './er/layout.ts'
import { renderErSvg } from './er/renderer.ts'
import { renderErAscii } from './ascii/er-diagram.ts'
import type { ErDiagram, PositionedErDiagram } from './er/types.ts'

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
 * Small, closed set of ASCII-only extras not every type needs — today only
 * `class` reads `hyperlinks` (see `ClassAsciiOptions` in
 * src/ascii/class-diagram.ts). Kept as its own type here, rather than
 * importing `AsciiRenderOptions` from src/ascii/index.ts, to avoid a
 * type-only import cycle between that module and this one (ascii/index.ts
 * would need to import `DiagramModule` from here).
 */
export interface AsciiRenderExtras {
  hyperlinks?: boolean
}

/**
 * One diagram type's full registration.
 *
 * `layoutForSvg` is deliberately SVG-only — it is NOT shared with
 * `renderAscii`, unlike the issue's original `{ detect, parse, layout,
 * renderSvg, renderAscii }` sketch. Reading every ASCII per-type module
 * confirmed why a single shared `layout` step would be fiction, not
 * simplification, for this codebase: SVG layout produces pixel coordinates
 * (`PositionedXYChart`, `PositionedErDiagram`, …), while every ASCII
 * renderer does its own, unrelated grid/canvas layout internally — see
 * e.g. src/ascii/xychart.ts's file header: "Uses the parsed XYChart type
 * directly (not PositionedXYChart) since pixel coordinates don't map to
 * character grids." `parse` genuinely is shared (both front doors already
 * import the same `parseXYChart`/`parseErDiagram`/etc.), which is why it
 * stays a real interface method here; `renderAscii` instead reruns its own
 * parse+layout+render internally from raw text, exactly as it does today.
 */
export interface DiagramModule<TDiagram = unknown, TPositioned = unknown> {
  readonly type: DiagramType
  parse(lines: string[]): TDiagram
  layoutForSvg(diagram: TDiagram, options: RenderOptions): TPositioned
  renderSvg(
    positioned: TPositioned,
    ctx: SvgRenderContext,
    options: RenderOptions,
  ): string
  renderAscii(
    text: string,
    config: AsciiConfig,
    colorMode: ColorMode,
    theme: AsciiTheme,
    extras: AsciiRenderExtras,
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
  renderAscii: (text, config, colorMode, theme) =>
    renderXYChartAscii(text, config, colorMode, theme),
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
  renderAscii: (text, config, colorMode, theme) =>
    renderErAscii(text, config, colorMode, theme),
}

/**
 * The registry proper. Only diagram types listed here are looked up by the
 * two front doors; anything absent (currently 'sequence', 'class',
 * 'flowchart') falls through to that front door's own switch, unchanged.
 *
 * Typed with `any` type parameters at the map level: each entry's own
 * `TDiagram`/`TPositioned` are only known inside that entry's own closure
 * (see `xychartModule`/`erModule` above, which are fully typed); the map
 * just needs one consistent shape to hold heterogeneous entries in.
 */
type AnyDiagramModule = DiagramModule<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above; each entry is fully typed at its own definition site.
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above; each entry is fully typed at its own definition site.
  any
>

export const diagramRegistry: Partial<Record<DiagramType, AnyDiagramModule>> = {
  xychart: xychartModule,
  er: erModule,
}
