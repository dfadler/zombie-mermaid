// ============================================================================
// Browser entry point for zombie-mermaid
//
// Exposes renderMermaid and renderMermaidASCII on window.__mermaid so they
// can be called from inline <script> tags in samples.html.
//
// Bundled via esbuild's `build({ platform: 'browser' })` in index.ts.
// ============================================================================

import { renderMermaidSVGAsync } from './index.ts'
import { renderMermaidASCII, diagramColorsToAsciiTheme } from './ascii/index.ts'
import { THEMES } from './theme.ts'
import { getSeriesColor, CHART_ACCENT_FALLBACK } from './xychart/colors.ts'

interface MermaidBrowserGlobal {
  renderMermaidSVGAsync: typeof renderMermaidSVGAsync
  renderMermaidASCII: typeof renderMermaidASCII
  diagramColorsToAsciiTheme: typeof diagramColorsToAsciiTheme
  THEMES: typeof THEMES
  getSeriesColor: typeof getSeriesColor
  CHART_ACCENT_FALLBACK: typeof CHART_ACCENT_FALLBACK
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
}
