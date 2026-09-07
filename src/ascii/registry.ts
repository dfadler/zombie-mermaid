// ============================================================================
// zombie-mermaid — ASCII half of the per-diagram-type registry (issue #533)
//
// `src/diagram-registry.ts` used to hold both halves of each registered
// diagram type: `renderSvg` (plus `parse`/`layoutForSvg`) AND `renderAscii`.
// That made the SVG-side module import `renderXYChartAscii`/`renderErAscii`
// out of `src/ascii/`, while `src/ascii/index.ts` imported `diagramRegistry`
// back out of `src/`. A cycle:
//
//   src/ascii/index.ts -> src/diagram-registry.ts -> src/ascii/xychart.ts
//                                                 -> src/ascii/er-diagram.ts
//
// Benign while both halves live in one package; fatal to the monorepo split
// scoped in docs/decisions/monorepo-conversion-scoping.md (#416/#620), where
// `src/ascii/**` becomes `@zombie-mermaid/ascii-renderer` and the SVG side
// stays behind — a package-level import cycle, not just a module-level one.
// It also had a measurable cost today: `dist/ascii.js` carried
// `import "elkjs/lib/elk.bundled.js"` purely because the registry dragged
// `src/er/layout.ts` -> `src/elk-instance.ts` into the ASCII entry's module
// graph, which is precisely what the `./ascii` subpath export (#300) exists
// to avoid.
//
// Splitting the table by renderer removes the back-edge: the ASCII side owns
// its own dispatch here, and `src/diagram-registry.ts` keeps the SVG side and
// no longer names anything under `src/ascii/`. Both directions are now
// one-way, and the set of registered types stays a single decision per
// renderer rather than a `switch` re-listed at each front door — the point of
// #533. Adding a type to one renderer's table without the other is now
// expressible, which matches reality: 'sequence'/'class'/'flowchart' are
// unregistered on both sides today only because neither renderer's signature
// has been adapted yet, not because the two must move in lockstep.
// ============================================================================

import type { DiagramType } from '../diagram-type.ts'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { renderXYChartAscii } from './xychart.ts'
import { renderErAscii } from './er-diagram.ts'

/**
 * Small, closed set of ASCII-only extras not every type needs — today only
 * `class` reads `hyperlinks` (see `ClassAsciiOptions` in
 * src/ascii/class-diagram.ts), and `class` is not registered here yet. Kept
 * as its own type rather than reusing `AsciiRenderOptions` from
 * src/ascii/index.ts so this module stays a leaf of the ASCII tree: index.ts
 * imports it, never the other way round.
 */
export interface AsciiRenderExtras {
  hyperlinks?: boolean
}

/**
 * One registered diagram type's ASCII entry point. Every ASCII renderer
 * reruns its own parse + grid layout + draw from raw text — there is no
 * shared positioned model to hand it, unlike the SVG side's
 * `parse`/`layoutForSvg` split (see `DiagramModule` in
 * src/diagram-registry.ts for why a shared layout step would be fiction
 * here).
 */
export type AsciiRenderer = (
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
  extras: AsciiRenderExtras,
) => string

/**
 * Types `renderMermaidASCII` dispatches through the registry. Anything
 * absent (currently 'sequence', 'class', 'flowchart') falls through to that
 * function's own switch, unchanged.
 */
export const asciiRegistry: Partial<Record<DiagramType, AsciiRenderer>> = {
  xychart: (text, config, colorMode, theme) =>
    renderXYChartAscii(text, config, colorMode, theme),
  er: (text, config, colorMode, theme) =>
    renderErAscii(text, config, colorMode, theme),
}
