// ============================================================================
// Browser entry point for zombie-mermaid
//
// Exposes renderMermaid and renderMermaidASCII on window.__mermaid so they
// can be called from inline <script> tags in samples.html.
//
// Bundled for the browser via Vite's build() API (scripts/vite-bundle.ts),
// from both index.ts and editor.ts.
// ============================================================================

import { renderMermaidSVGAsync } from './index.ts'
import { renderMermaidASCII, diagramColorsToAsciiTheme } from './ascii/index.ts'
import { THEMES } from './theme.ts'
import { getSeriesColor, CHART_ACCENT_FALLBACK } from './xychart/colors.ts'
import { isWideChar } from './text-metrics.ts'

export interface MermaidBrowserGlobal {
  renderMermaidSVGAsync: typeof renderMermaidSVGAsync
  renderMermaidASCII: typeof renderMermaidASCII
  diagramColorsToAsciiTheme: typeof diagramColorsToAsciiTheme
  THEMES: typeof THEMES
  getSeriesColor: typeof getSeriesColor
  CHART_ACCENT_FALLBACK: typeof CHART_ACCENT_FALLBACK
  /**
   * The renderer's own wide-character predicate.
   *
   * The demo needs it to give CJK/fullwidth glyphs their two terminal
   * columns in the DOM (a browser font gives them whatever advance it
   * likes). Exposing the renderer's own predicate keeps the page and the
   * ASCII box math from disagreeing about which characters are wide.
   */
  isWideChar: typeof isWideChar
}

// `lib` in tsconfig.json is `["ESNext"]` (no `dom`), so `window` isn't
// ambiently declared — this bundle only ever runs in a browser though
// (see file header), so we declare just the shape we attach to it.
declare const window: { __mermaid: MermaidBrowserGlobal }

window.__mermaid = {
  renderMermaidSVGAsync,
  renderMermaidASCII,
  diagramColorsToAsciiTheme,
  THEMES,
  getSeriesColor,
  CHART_ACCENT_FALLBACK,
  isWideChar,
}
