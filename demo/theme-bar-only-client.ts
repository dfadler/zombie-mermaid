/**
 * Bundle entry point for a page that mounts {@link ThemePickerSection}
 * (`demo/components/theme-picker-section.tsx`) and needs no other client
 * JS of its own — Blog, Fork Fixes, and Dashboard as of #687 (the Diagrams
 * hub dropped `ThemePickerSection`, and so this bundle, when its own "Pick
 * a look" section was removed). Hydrates the `ThemePicker` island
 * (`demo/theme-bar-client.tsx`'s
 * `hydrateThemeBar()`, replacing the imperative `initThemeBar()` deleted by
 * #801), and — as of #772 — the surrounding site chrome (Nav/Footer/cards)
 * via `initChromeTheme()` (`demo/chrome-theme-client.ts`), reading the
 * `bg`/`fg` table `ThemePickerSection` embeds as `window.__themeColors`.
 * Re-theming a live diagram is still not this file's job — no page that
 * uses this bundle renders one (contrast `demo/diagram-page-client.ts`).
 *
 * A dedicated one-line entry rather than bundling `theme-bar-client.tsx`
 * directly: `bundleForBrowser` needs a real entry module whose top-level
 * code runs the side effect, and keeping that call out of `theme-bar-
 * client.tsx` itself keeps that module import-safe for its own unit tests.
 */
import { hydrateThemeBar } from './theme-bar-client.tsx'
import { initChromeTheme } from './chrome-theme-client.ts'
import type { ChromeThemeColors } from './components/chrome-theme.ts'

declare global {
  interface Window {
    __themeColors: Record<string, ChromeThemeColors>
  }
}

hydrateThemeBar()
initChromeTheme(window.__themeColors)
