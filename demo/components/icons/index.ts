/**
 * The redesign's icon set (#596, part of the #591 component library and the
 * #590 site redesign) — stroke-based inline SVG, never emoji.
 *
 * Every path in this directory was lifted verbatim from the design canvas
 * linked in #590's body
 * (`https://claude.ai/code/artifact/2f623662-5eaf-42c4-9fd9-c21588e34993`),
 * read through the same route tokens.tsx used: the canvas's `appifact-doc`
 * script block carries one `.dc.html` source per artboard, and the icons are
 * the `viewBox="0 0 24 24"` SVGs inside them. Nothing here was drawn from
 * scratch; each icon's own `CANVAS` note names the artboard and the heading
 * or `aria-label` it sits under, so a path can be traced back.
 *
 * The canvas's eighteen artboards are three families: the sixteen
 * "Diagram-Native Showcase" pages (eight, each desktop + mobile) that
 * tokens.tsx treats as canonical, plus two single-artboard explorations
 * (`TerminalNative`, `EditorialProduct`) that restate the same six features
 * with different drawings at `stroke-width: 1.6`. This module follows the
 * canonical sixteen throughout, so the six feature icons here are the ones
 * on the home page's feature grid.
 *
 * Two things the canvas does NOT have, and this module therefore does not
 * invent: a pan control (the editor toolbar's third button is "Fit to
 * view", `FitToViewIcon`) and a GitHub or npm mark (the nav links to
 * GitHub as plain text and shows `npm install zombie-mermaid` as a text
 * pill).
 *
 * Originally one file (`icons.tsx`); split (#934) into one module per icon
 * family, mirroring #932's index-app.tsx split and #933's nav.tsx split:
 *
 * - `base.tsx` — the shared stroke style, `IconProps`, and the `StrokeIcon`
 *   wrapper every icon renders through.
 * - `feature-icons.tsx` — the home page's feature grid and feature-pillars
 *   icons.
 * - `diagram-type-icons.tsx` — the six animated diagram-type icons (#597).
 * - `editor-toolbar-icons.tsx` — the editor toolbar's chrome icons.
 * - `chrome-icons.tsx` — the recurring nav, footer, and page chrome icons.
 * - `logo-mark.tsx` — the three-colour brand mark, deliberately excluded
 *   from `ICONS`.
 * - `registry.ts` — `ICONS`, `IconName`, `FEATURE_ICONS`, and
 *   `DIAGRAM_TYPE_ICONS`, which reference every icon component above.
 *
 * `../icons.tsx` re-exports this module's full surface, at the same import
 * path every existing call site already uses, so nothing outside this
 * directory needs to change.
 */

// Named, not `export *`: base.tsx also exports `StrokeIcon`, the internal
// wrapper every icon file below shares — never part of the original
// icons.tsx's public surface, so it stays out of this barrel too.
export {
  ICON_VIEW_BOX,
  ICON_STROKE_WIDTH,
  ICON_LINE_CAP,
  ICON_DEFAULT_SIZE,
} from './base.tsx'
export type { IconProps } from './base.tsx'
export * from './feature-icons.tsx'
export * from './diagram-type-icons.tsx'
export * from './editor-toolbar-icons.tsx'
export * from './chrome-icons.tsx'
export * from './logo-mark.tsx'
export * from './registry.ts'
