/**
 * Bundle entry point for a page that mounts {@link ThemePickerSection}
 * (`demo/components/theme-picker-section.tsx`) and needs no other client
 * JS of its own — Home, the Diagrams hub, Blog, Fork Fixes, and Dashboard
 * as of #687. Wires the already-rendered `ThemeBar`/`ThemePicker` markup
 * to `demo/theme-state.ts` via `initThemeBar()`
 * (`demo/components/theme-bar-client.ts`), and — as of #772 — re-themes the
 * surrounding site chrome (Nav, Footer, cards) via `demo/site-chrome-
 * theme.ts`'s `applyThemeToSiteChrome()` on every theme change, same-tab or
 * cross-tab. This page has no live diagram of its own to re-theme (contrast
 * `demo/diagram-page-client.ts`, which does that in addition to this).
 *
 * A dedicated one-line-ish entry rather than bundling `theme-bar-client.ts`
 * directly: `bundleForBrowser` needs a real entry module whose top-level
 * code runs the side effect, and keeping that call out of `theme-bar-
 * client.ts` itself keeps that module import-safe for its own unit tests
 * (`__tests__/demo-theme-bar-client.test.ts`), which call `initThemeBar()`
 * against a hand-built DOM rather than a real page load.
 */
import { initThemeBar } from './components/theme-bar-client.ts'
import { getTheme, subscribe } from './theme-state.ts'
import { applyThemeToSiteChrome } from './site-chrome-theme.ts'

initThemeBar()
subscribe(applyThemeToSiteChrome)

// Restore a previously picked theme's chrome immediately on load, mirroring
// diagram-page-client.ts's identical restore-on-load pattern. A no-op when
// getTheme() is '' (Default): applyThemeToSiteChrome() just clears
// overrides that were never set, matching the page's own SSR default.
applyThemeToSiteChrome(getTheme())
