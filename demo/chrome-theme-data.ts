/**
 * Server-side-only counterpart to `demo/chrome-theme-client.ts`: builds the
 * `bg`/`fg` table it needs, embedded as inline JSON.
 *
 * Deliberately its own module rather than living in `demo/components/
 * chrome-theme.ts`: that module is also bundled for the browser (via
 * `demo/chrome-theme-client.ts`), and importing `@zombie-mermaid/core`
 * there would pull the whole rendering engine into every page's client JS
 * — exactly what `demo/diagram-page-client.ts`'s header comment already
 * calls out avoiding for the same reason (`window.__diagramPageThemes`
 * instead of an import). This file only ever runs under Node (`tsx`, at
 * build time), so importing `@zombie-mermaid/core` here is free.
 */
import { THEMES } from '@zombie-mermaid/core'
import { escapeJsonForScriptTag } from './format.ts'
import type { ChromeThemeColors } from './components/chrome-theme.ts'

/** Every built-in theme's `bg`/`fg`, keyed the same as `THEMES` itself. */
export function chromeThemeColorsTable(): Record<string, ChromeThemeColors> {
  const table: Record<string, ChromeThemeColors> = {}
  for (const [key, colors] of Object.entries(THEMES)) {
    table[key] = { bg: colors.bg, fg: colors.fg }
  }
  return table
}

/**
 * `window.__themeColors = {…};`, safe to embed in a `<script>` element —
 * see `escapeJsonForScriptTag`. Read by `demo/chrome-theme-client.ts`'s
 * `initChromeTheme()` on every page that mounts `ThemePickerSection`.
 */
export function chromeThemeColorsScript(): string {
  const json = escapeJsonForScriptTag(JSON.stringify(chromeThemeColorsTable()))
  return `window.__themeColors = ${json};`
}
