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
// Only 'xychart' and 'er' are registered here. Those two are the only
// diagram types whose existing renderer signatures adapt to a shared shape
// with zero behavior change — see the issue-533 scoping doc (in the PR/
// issue body) for why 'sequence', 'class', and 'flowchart' are NOT
// registered yet and what would need to change first. The front door
// checks this table first; anything absent falls through to its own
// switch, completely unchanged.
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
import { withDirectionOverride } from '@zombie-mermaid/core'

import { parseXYChart, parseErDiagram } from '@zombie-mermaid/mermaid-parser'
import type {
  XYChart,
  PositionedXYChart,
  ErDiagram,
  PositionedErDiagram,
} from '@zombie-mermaid/mermaid-parser'
import {
  layoutXYChart,
  renderXYChartSvg,
  layoutErDiagramSync,
  renderErSvg,
} from '@zombie-mermaid/svg-renderer'

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
 * The registry proper. Only diagram types listed here are looked up by the
 * SVG front door; anything absent (currently 'sequence', 'class',
 * 'flowchart') falls through to that front door's own switch, unchanged.
 * The ASCII front door's equivalent table is `asciiRegistry` in
 * src/ascii/registry.ts.
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
