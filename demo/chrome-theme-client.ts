/**
 * Applies {@link chromeThemeVars} to the live page — the client half of
 * #772's site-chrome re-theming, paired with `demo/components/chrome-
 * theme.ts`'s pure color computation.
 *
 * Deliberately separate from `demo/components/theme-bar-client.ts` (which
 * only tracks pill selection) and `demo/diagram-page-client.ts` (which
 * re-themes a live `<svg>` plus that page's own legacy `--t-*` card): site
 * chrome — Nav, Footer, cards — is common to every page this repo has, so
 * it gets its own module that any page-client can call alongside those,
 * rather than being bolted onto either.
 *
 * `initChromeTheme()` never touches `tokens.tsx`'s authored `:root{}`
 * defaults: it only ever sets/removes *inline* properties on
 * `document.documentElement`, which win the cascade over the stylesheet
 * while set and fall back to it cleanly once removed. Picking "Default"
 * therefore restores the exact original look, byte for byte, with no
 * separate reset table to keep in sync.
 */
import {
  chromeThemeVars,
  CHROME_REACTIVE_TOKENS,
  type ChromeThemeColors,
} from './components/chrome-theme.ts'
import { DEFAULT_THEME_KEY, getTheme, subscribe } from './theme-state.ts'

/**
 * The `.nav-bar` translucent fill (`demo/components/nav.tsx`'s `bgRgba()`)
 * is a literal `rgba(…)` baked at build time from `tokens.tsx`'s fixed
 * `--bg` — not a `var(--bg)` reference — because `Nav` is pinned
 * byte-for-byte to the #590 design canvas (see `theme-picker-section.tsx`'s
 * header comment) and a `color-mix()`-based rewrite would be a source
 * change to that pinned component, not just a runtime one. This mirrors it
 * at the DOM level instead: same alpha, computed from whichever theme is
 * live.
 */
const NAV_BAR_ALPHA = 0.85

function hexToRgba(hex: string, alpha: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export interface ChromeThemeController {
  /** Unsubscribes from `theme-state.ts`. Leaves whatever's currently applied in place. */
  destroy(): void
}

/**
 * Wires site-chrome re-theming to `theme-state.ts`: applies whatever theme
 * is already stored (a returning visitor's choice) immediately, then keeps
 * the chrome in sync with every future `setTheme()` call — same-tab or
 * cross-tab — for as long as the page stays open (or until `destroy()`).
 *
 * `colors` only needs `bg`/`fg` per theme key, so callers can pass either a
 * purpose-built table (`ThemePickerSection`'s embedded `window.__themeColors`)
 * or the fuller `DiagramColors` table `demo/diagram-page-client.ts` already
 * has on `window.__diagramPageThemes` — structurally compatible, extra
 * fields ignored.
 *
 * The `.nav-bar` element's original inline background is captured once, on
 * the first call this instance makes, from a fresh closure variable — not a
 * module-level one — so two independent `initChromeTheme()` calls (as
 * `__tests__/demo-chrome-theme-client.test.ts` makes, one per test, each
 * against its own freshly-rendered DOM) never share state.
 */
export function initChromeTheme(
  colors: Record<string, ChromeThemeColors>,
): ChromeThemeController {
  let navBarDefaultBackground: string | null = null

  function applyChromeTheme(themeKey: string): void {
    const root = document.documentElement
    const navBar = document.querySelector<HTMLElement>('.nav-bar')
    if (navBar && navBarDefaultBackground === null) {
      navBarDefaultBackground = navBar.style.background
    }

    const theme = themeKey === DEFAULT_THEME_KEY ? undefined : colors[themeKey]

    if (!theme) {
      for (const token of CHROME_REACTIVE_TOKENS) {
        root.style.removeProperty(token)
      }
      if (navBar) navBar.style.background = navBarDefaultBackground ?? ''
      return
    }

    const vars = chromeThemeVars(theme)
    for (const [token, value] of Object.entries(vars)) {
      root.style.setProperty(token, value)
    }
    if (navBar) navBar.style.background = hexToRgba(theme.bg, NAV_BAR_ALPHA)
  }

  applyChromeTheme(getTheme())
  const unsubscribe = subscribe(applyChromeTheme)

  return { destroy: unsubscribe }
}
