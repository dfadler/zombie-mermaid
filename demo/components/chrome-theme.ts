/**
 * Derives tokens.tsx's chrome palette (`--bg`, `--panel`, `--text`, …) from
 * a theme's `bg`/`fg` pair — the piece #763 left unimplemented, tracked as
 * #772 ("Theme selector: re-theme site chrome, not just diagrams").
 *
 * Before the #590 redesign, picking a theme reskinned the whole site: the
 * old `demo/client.ts`'s `applyTheme()` set three vars on `document.body`
 * (`--t-bg`/`--t-fg`/`--t-accent`) and the old `demo/styles.css` built every
 * chrome rule around them. The redesign replaced that with a *fixed* dark
 * palette in `tokens.tsx`'s `COLORS` — Nav/Footer/primitives all render
 * from those hardcoded hex values regardless of the selected theme. This
 * module is the missing piece that makes them reactive again, without
 * touching `tokens.tsx`'s own authored defaults (see `chrome-theme-client.ts`
 * for how these are applied and rolled back).
 *
 * Only the eight *surface and ink* tokens are theme-reactive:
 * `--bg`/`--bg-soft`/`--panel`/`--panel-2`/`--border`/`--text`/`--text-dim`/
 * `--text-faint`. The six named accents (`--blue`/`--violet`/`--cyan`/
 * `--pink`/`--amber`/`--green`) stay fixed on purpose — each one is tied to
 * a specific diagram type across icons, cards, and swatches (blue =
 * flowchart, violet = state, …), a structural identity, not a "mood" a
 * theme pick should overwrite. The old system had no equivalent: its single
 * `--t-accent` was one color for the whole chrome, a simpler problem than
 * keeping six *independent* per-diagram-type identities intact.
 */

/** The two colors every built-in theme guarantees (`packages/core/src/theme.ts::DiagramColors`). */
export interface ChromeThemeColors {
  bg: string
  fg: string
}

/**
 * The `tokens.tsx` `COLORS` keys this module overrides. Also the exact set
 * `chrome-theme-client.ts` removes (via `CSSStyleDeclaration.removeProperty`)
 * to restore `tokens.tsx`'s authored defaults when "Default" is picked.
 */
export const CHROME_REACTIVE_TOKENS = [
  '--bg',
  '--bg-soft',
  '--panel',
  '--panel-2',
  '--border',
  '--text',
  '--text-dim',
  '--text-faint',
] as const

/**
 * `color-mix()` weights for the five derived surface/ink tokens, each
 * blending `fg` into `bg` at the given percentage — the same technique
 * `packages/core/src/theme.ts` (`MIX`) already uses to derive SVG colors,
 * and `demo/diagram-page.css` already uses for its own page-local `--t-*`
 * chrome (`--t-muted` at 55%, `--t-border` at 12%, panel fills at 4%/8%).
 * Reusing that established idiom means every one of the 15 built-in themes
 * gets a coherent chrome palette for free, from just its `bg`/`fg` pair,
 * rather than each needing its own hand-authored 8-color chrome palette.
 *
 * Tuned slightly cooler than `demo/diagram-page.css`'s numbers (that CSS
 * targets a single light card on any theme; this targets a full dark-first
 * UI shell) — a deliberate, revisitable starting point, not a derived
 * constant.
 */
const MIX = {
  bgSoft: 4,
  panel: 8,
  panel2: 12,
  border: 18,
  textDim: 60,
  textFaint: 38,
} as const

function mix(fg: string, bg: string, percent: number): string {
  return `color-mix(in srgb, ${fg} ${percent}%, ${bg})`
}

/**
 * Computes the eight {@link CHROME_REACTIVE_TOKENS} values for `colors`, as
 * `color-mix()` CSS strings (resolved by the browser at paint time — no
 * color math needed here). `--bg`/`--text` are the theme's `bg`/`fg`
 * verbatim; the rest are derived from them.
 */
export function chromeThemeVars(
  colors: ChromeThemeColors,
): Record<(typeof CHROME_REACTIVE_TOKENS)[number], string> {
  const { bg, fg } = colors
  return {
    '--bg': bg,
    '--bg-soft': mix(fg, bg, MIX.bgSoft),
    '--panel': mix(fg, bg, MIX.panel),
    '--panel-2': mix(fg, bg, MIX.panel2),
    '--border': mix(fg, bg, MIX.border),
    '--text': fg,
    '--text-dim': mix(fg, bg, MIX.textDim),
    '--text-faint': mix(fg, bg, MIX.textFaint),
  }
}
