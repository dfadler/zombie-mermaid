// ============================================================================
// Self-contained HTML viewer for the CLI's `render --html` output.
//
// Produces one file — no server, no network, no external references — that
// wraps a rendered SVG in a pan/zoom viewer: drag-to-pan, scroll-to-pan,
// ctrl/cmd+scroll and pinch to zoom, fit/1:1 buttons, a light/dark toggle
// that follows `prefers-color-scheme`, and keyboard controls. Opens from
// disk, survives being emailed, and prints cleanly (the viewer chrome is
// hidden in `@media print`).
//
// This file, and the interactive script it inlines
// (html-viewer-client.js, embedded via html-viewer-client-source.ts),
// is the one place in this project that ships client-side JavaScript. That
// is a deliberate, narrow exception: the *library's* SVG output stays
// permanently script-free (see docs/decisions/no-script-interactivity.md) —
// this viewer is a separate artifact the CLI writes on request, never part
// of `renderMermaidSVG`'s own output, and the SVG embedded inside it is
// unchanged from what the library produced.
// ============================================================================

import { escapeXml } from '../multiline-utils.ts'
import { HTML_VIEWER_CLIENT_JS } from './html-viewer-client-source.ts'

/** Options controlling the generated viewer page. */
export interface HtmlViewerOptions {
  /** The rendered SVG markup to embed (trusted output of this library). */
  svg: string
  /** Page `<title>`; falls back to a generic title when omitted/empty. */
  title?: string
}

const PAGE_CSS = `
  :root {
    color-scheme: light dark;
    --bg: #f4f4f5;
    --fg: #18181b;
    --chrome-bg: #ffffff;
    --chrome-border: #e4e4e7;
    --chrome-fg: #3f3f46;
    --chrome-fg-hover: #18181b;
    --focus-ring: #2563eb;
  }
  :root[data-theme='dark'] {
    --bg: #09090b;
    --fg: #fafafa;
    --chrome-bg: #18181b;
    --chrome-border: #3f3f46;
    --chrome-fg: #d4d4d8;
    --chrome-fg-hover: #fafafa;
    --focus-ring: #60a5fa;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) {
      --bg: #09090b;
      --fg: #fafafa;
      --chrome-bg: #18181b;
      --chrome-border: #3f3f46;
      --chrome-fg: #d4d4d8;
      --chrome-fg-hover: #fafafa;
      --focus-ring: #60a5fa;
    }
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    height: 100%;
    background: var(--bg);
    color: var(--fg);
    font: 14px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  #stage {
    position: fixed;
    inset: 0;
    overflow: hidden;
    cursor: grab;
    touch-action: none;
    outline: none;
  }
  #stage.dragging { cursor: grabbing; }
  #diagram {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: 0 0;
    will-change: transform;
  }
  #diagram svg { display: block; }
  #toolbar {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px;
    border-radius: 10px;
    background: var(--chrome-bg);
    border: 1px solid var(--chrome-border);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }
  #toolbar button {
    appearance: none;
    border: none;
    background: transparent;
    color: var(--chrome-fg);
    font: inherit;
    font-size: 13px;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    min-width: 32px;
  }
  #toolbar button:hover { color: var(--chrome-fg-hover); background: var(--chrome-border); }
  #toolbar button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }
  #zoom {
    min-width: 3.5em;
    text-align: center;
    color: var(--chrome-fg);
    font-variant-numeric: tabular-nums;
  }
  #stage:focus-visible {
    box-shadow: inset 0 0 0 2px var(--focus-ring);
  }
  @media print {
    #toolbar { display: none; }
    #stage { position: static; overflow: visible; }
    #diagram { position: static; transform: none !important; }
  }
`.trim()

/**
 * Build a self-contained HTML viewer page embedding the given SVG.
 *
 * The returned string has no external references (no CDN scripts, no
 * network fonts) and can be written to disk and opened directly, or
 * emailed as a single attachment.
 */
export function buildHtmlViewer(options: HtmlViewerOptions): string {
  const title = options.title?.trim() || 'Mermaid diagram'
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeXml(title)}</title>
<style>
${PAGE_CSS}
</style>
</head>
<body>
<div id="stage" tabindex="0" role="application" aria-label="Diagram viewer. Drag or arrow keys to pan, plus/minus to zoom, 0 to fit, 1 for 100%, T to toggle theme.">
  <div id="diagram">
${options.svg}
  </div>
</div>
<div id="toolbar">
  <button id="zoom-out" type="button" aria-label="Zoom out (-)">&minus;</button>
  <span id="zoom" aria-live="polite">100%</span>
  <button id="zoom-in" type="button" aria-label="Zoom in (+)">+</button>
  <button id="fit" type="button" aria-label="Fit to window (0)">Fit</button>
  <button id="one" type="button" aria-label="Actual size (1)">1:1</button>
  <button id="theme" type="button" aria-pressed="false" aria-label="Switch to dark mode (T)">Dark</button>
</div>
<script>
${HTML_VIEWER_CLIENT_JS}
</script>
</body>
</html>
`
}
