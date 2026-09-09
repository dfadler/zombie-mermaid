/** @jsxRuntime automatic */
/**
 * Hydrates `<ThemePicker>` — the shared client-side entry point every page's
 * `#theme-pills` hydration island (`demo/components/theme-picker-island.tsx`'s
 * `ThemePickerIsland`) mounts against (zombie-mermaid#801), replacing
 * `demo/components/theme-bar-client.ts`'s deleted `initThemeBar()`.
 *
 * A plain exported function, not a top-level side-effecting `main()` call —
 * mirrors `demo/nav-client.tsx`'s `hydrateNav()` exactly, for the same
 * reason: every page bundles this alongside other client entry points
 * (`demo/theme-bar-only-client.ts`, `demo/diagram-page-client.ts`,
 * `demo/index-page-client.ts`) rather than needing a dedicated bundle of its
 * own.
 *
 * Imports {@link ThemePicker} and the id constants from `theme-picker.tsx`
 * directly, *not* from `theme-picker-island.tsx` — that file imports
 * `react-dom/server` for its own SSR-only purposes, and importing from it
 * here would drag that dependency into every page's browser bundle for no
 * reason (the exact hazard `demo/nav-client.tsx`'s own header comment
 * documents for the identical split).
 */
import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import {
  THEME_PILLS_PROPS_ELEMENT_ID,
  THEME_PILLS_ROOT_ID,
  ThemePicker,
  type ThemePickerProps,
} from './components/theme-picker.tsx'

function readThemePickerProps(): ThemePickerProps {
  const propsEl = document.getElementById(THEME_PILLS_PROPS_ELEMENT_ID)
  if (!propsEl?.textContent) {
    throw new Error(
      `theme-bar-client: no #${THEME_PILLS_PROPS_ELEMENT_ID} element with JSON content found`,
    )
  }
  return JSON.parse(propsEl.textContent) as ThemePickerProps
}

/**
 * Hydrates the page's `#theme-pills` island, if it has one.
 *
 * A silent no-op when {@link THEME_PILLS_ROOT_ID} isn't present, mirroring
 * `initThemeBar()`'s own former contract ("a page with no theme bar can
 * safely call this unconditionally") — every current production caller does
 * always render one, but nothing here should assume that stays true.
 */
export function hydrateThemeBar(): void {
  const container = document.getElementById(THEME_PILLS_ROOT_ID)
  if (!container) return
  hydrateRoot(container, createElement(ThemePicker, readThemePickerProps()))
}
