/**
 * Bundle entry point for a page that mounts {@link ThemePickerSection}
 * (`demo/components/theme-picker-section.tsx`) and needs no other client
 * JS of its own — Home, the Diagrams hub, Blog, Fork Fixes, and Dashboard
 * as of #687. Just wires the already-rendered `ThemeBar`/`ThemePicker`
 * markup to `demo/theme-state.ts` via `initThemeBar()`
 * (`demo/components/theme-bar-client.ts`); nothing here re-themes a live
 * diagram or the surrounding page chrome (contrast `demo/diagram-page-
 * client.ts`, which does both in addition to this).
 *
 * A dedicated one-line entry rather than bundling `theme-bar-client.ts`
 * directly: `bundleForBrowser` needs a real entry module whose top-level
 * code runs the side effect, and keeping that call out of `theme-bar-
 * client.ts` itself keeps that module import-safe for its own unit tests
 * (`__tests__/demo-theme-bar-client.test.ts`), which call `initThemeBar()`
 * against a hand-built DOM rather than a real page load.
 */
import { initThemeBar } from './components/theme-bar-client.ts'

initThemeBar()
