/**
 * Bundle entry point for a page that mounts {@link ThemePickerSection}
 * (`demo/components/theme-picker-section.tsx`) and needs no other client
 * JS of its own — Home, the Diagrams hub, Blog, Fork Fixes, and Dashboard
 * as of #687. Wires the already-rendered `ThemeBar`/`ThemePicker` markup to
 * `demo/theme-state.ts` via `initThemeBar()` (`demo/components/theme-bar-
 * client.ts`), and — as of #772 — the surrounding site chrome (Nav/Footer/
 * cards) via `initChromeTheme()` (`demo/chrome-theme-client.ts`), reading
 * the `bg`/`fg` table `ThemePickerSection` embeds as `window.__themeColors`.
 * Re-theming a live diagram is still not this file's job — no page that
 * uses this bundle renders one (contrast `demo/diagram-page-client.ts`).
 *
 * A dedicated one-line entry rather than bundling `theme-bar-client.ts`
 * directly: `bundleForBrowser` needs a real entry module whose top-level
 * code runs the side effect, and keeping that call out of `theme-bar-
 * client.ts` itself keeps that module import-safe for its own unit tests
 * (`__tests__/demo-theme-bar-client.test.ts`), which call `initThemeBar()`
 * against a hand-built DOM rather than a real page load.
 */
import { initThemeBar } from './components/theme-bar-client.ts'
import { initChromeTheme } from './chrome-theme-client.ts'
import type { ChromeThemeColors } from './components/chrome-theme.ts'

declare global {
  interface Window {
    __themeColors: Record<string, ChromeThemeColors>
  }
}

initThemeBar()
initChromeTheme(window.__themeColors)
