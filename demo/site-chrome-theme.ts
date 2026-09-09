/**
 * Re-themes the redesign's shared site chrome — Nav, Footer, and every
 * `demo/components/primitives.tsx` primitive (`Card`, `Pill`,
 * `SectionEyebrow`, `CTA`) — to track `demo/theme-state.ts`'s shared theme
 * preference, restoring the pre-#590 behavior where picking a theme
 * reskinned the whole site, not just a rendered diagram. Addresses #772.
 *
 * ## Why this works with almost no new CSS
 *
 * `demo/components/tokens.tsx`'s `designTokensCss()` already publishes its
 * palette as real CSS custom properties on `:root` (`colorVar()` returns
 * `var(--x)`, never a baked literal), and every consumer — Footer, the
 * primitives, `designBaseCss()`'s `body` rule — already reads colors
 * through those `var()` references rather than inlining hex. Nothing in
 * those components needed to change: they were already theme-*capable*,
 * just never driven, because nothing ever called
 * `documentElement.style.setProperty()` on one of these eight tokens after
 * the initial `:root` block was published. This module is that missing
 * driver — the same role `demo/diagram-page-client.ts`'s
 * `applyThemeToDiagram()` already plays for a rendered `<svg>`'s `--bg`/
 * `--fg`.
 *
 * The one exception is `demo/components/nav.tsx`'s `.nav-bar` background:
 * `bgRgba()` there computes a literal `rgba(10,13,22,0.85)` from tokens.tsx's
 * *fixed* `COLORS` at build/SSR time (not a `var()` reference), because Nav
 * is byte-pinned to the #590 design canvas
 * (`__tests__/demo-nav.test.ts` transcribes the canvas's own literal
 * `background:rgba(10,13,22,0.85)` declaration verbatim) and the canvas
 * itself has no CSS-variable indirection to preserve. Rather than change
 * Nav's SSR output — which would break that pin for no visual gain in the
 * untouched/Default case — {@link applyThemeToSiteChrome} instead sets the
 * `.nav-bar` element's `background` directly at runtime, the same
 * targeted-override technique `applyThemeToPage()` already uses in
 * `demo/diagram-page-client.ts` for values that aren't plain `var()`
 * passthroughs.
 *
 * ## Accents stay fixed
 *
 * The six named accents (`--blue`/`--violet`/`--cyan`/`--pink`/`--amber`/
 * `--green`) are deliberately left alone — they're semantic (flowchart is
 * always blue, state is always violet, etc.) and used for diagram-type
 * icons/CTAs across the site; remapping all six to one theme's accent would
 * flatten that color-coding. Only the eight surface/ink tokens
 * ({@link CHROME_VARS}) are re-derived per theme.
 *
 * ## Derivation
 *
 * A theme's `bg`/`fg` pair produces `--bg`/`--text` directly and the
 * remaining six via `color-mix(in srgb, fg X%, bg)`, reusing
 * `packages/core/src/theme.ts`'s own `MIX` percentages by name-matched
 * semantics (a group-header tint is a reasonable stand-in for "a background
 * one step lighter than the page", a key-badge tint for "a card fill one
 * step lighter still", and so on) — see {@link deriveChromeColors} — so the
 * homepage/nav/footer hierarchy derives from the same two base colors a
 * diagram's own `<style>` block already does, rather than inventing a
 * second, unrelated percentage table.
 *
 * The "Default" pseudo-theme (`''`, `demo/theme-state.ts`'s
 * `DEFAULT_THEME_KEY`) and any unrecognized key both mean "no override":
 * every custom property this module ever sets is removed, letting
 * tokens.tsx's own `:root` block (the fixed dark palette) show through
 * again exactly as it does on first paint.
 */
import { MIX, THEMES, type DiagramColors } from '@zombie-mermaid/core'
import { COLORS } from './components/tokens.tsx'
import { NAV_BG_ALPHA } from './components/nav.tsx'

/**
 * The eight `tokens.tsx` surface/ink custom properties this module
 * re-derives per theme, in the same order `COLORS` declares them.
 */
const CHROME_VARS = [
  '--bg',
  '--bg-soft',
  '--panel',
  '--panel-2',
  '--border',
  '--text',
  '--text-dim',
  '--text-faint',
] as const

type ChromeVar = (typeof CHROME_VARS)[number]

/**
 * `color-mix(in srgb, fg X%, bg)` — the same shape
 * `packages/core/src/theme.ts`'s `buildStyleBlock()` uses for a diagram's
 * derived variables, just evaluated against a theme's literal `bg`/`fg`
 * hex rather than a CSS `var()` chain (there is no `--fg` token in
 * tokens.tsx's namespace to reference).
 */
function mix(fg: string, bg: string, percent: number): string {
  return `color-mix(in srgb, ${fg} ${percent}%, ${bg})`
}

/**
 * Resolves the eight chrome tokens for one theme's `bg`/`fg` pair.
 *
 * Percentage-to-token mapping (see this module's header comment for the
 * reasoning): `--bg-soft` reuses {@link MIX.groupHeader} (5%, "a background
 * one step lighter than the page"), `--panel` reuses {@link MIX.keyBadge}
 * (10%), `--panel-2` reuses {@link MIX.innerStroke} (12%), `--border`
 * reuses {@link MIX.nodeStroke} (20%, already named for hairline strokes),
 * `--text-dim` reuses {@link MIX.textSec} (60%, "secondary text"), and
 * `--text-faint` reuses {@link MIX.textFaint} (25%) — every percentage here
 * is one `packages/core/src/theme.ts` already defines and names for a
 * closely analogous role, not a newly invented number.
 */
function deriveChromeColors(theme: DiagramColors): Record<ChromeVar, string> {
  const { bg, fg } = theme
  return {
    '--bg': bg,
    '--bg-soft': mix(fg, bg, MIX.groupHeader),
    '--panel': mix(fg, bg, MIX.keyBadge),
    '--panel-2': mix(fg, bg, MIX.innerStroke),
    '--border': mix(fg, bg, MIX.nodeStroke),
    '--text': fg,
    '--text-dim': mix(fg, bg, MIX.textSec),
    '--text-faint': mix(fg, bg, MIX.textFaint),
  }
}

/**
 * Sets `.nav-bar`'s `background` directly — see this module's header
 * comment for why Nav's SSR output can't just reference a `var()` here.
 * A page with no `.nav-bar` (there is always exactly one per page today,
 * but this stays defensive) is a silent no-op.
 */
function applyNavBarBackground(bg: string): void {
  const navBar = document.querySelector<HTMLElement>('.nav-bar')
  if (!navBar) return
  navBar.style.setProperty(
    'background',
    mix(bg, 'transparent', NAV_BG_ALPHA * 100),
  )
}

/**
 * Re-themes the site chrome for `themeKey` — every page that calls this on
 * every `demo/theme-state.ts` change (same-tab or cross-tab) gets a
 * reactive Nav/Footer/card palette, matching what `applyThemeToDiagram()`
 * already does for a rendered diagram.
 *
 * `themeKey` is `''` (Default) or unrecognized → clears every override
 * (`root.style.removeProperty`), letting tokens.tsx's fixed `:root` palette
 * show through again.
 */
export function applyThemeToSiteChrome(themeKey: string): void {
  const root = document.documentElement
  const theme = THEMES[themeKey]

  if (!theme) {
    for (const varName of CHROME_VARS) root.style.removeProperty(varName)
    applyNavBarBackground(COLORS['--bg'])
    return
  }

  const resolved = deriveChromeColors(theme)
  for (const varName of CHROME_VARS) {
    root.style.setProperty(varName, resolved[varName])
  }
  applyNavBarBackground(resolved['--bg'])
}
