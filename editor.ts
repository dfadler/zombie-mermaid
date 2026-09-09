/**
 * Generates editor.html — a live Mermaid editor similar to mermaid.live.
 *
 * Usage: tsx editor.ts
 *
 * The generated HTML is fully self-contained:
 *   - Bundles the mermaid renderer client-side
 *   - Live rendering on every keystroke (debounced)
 *   - URL hash sharing (base64-encoded source)
 *   - Theme switcher with all built-in themes
 *   - Download SVG / Copy link
 *
 * Source files are organized in editor/:
 *   - editor/css/  — modular CSS components
 *   - editor/js/   — the editor's client-side TS modules (editor/js/index.ts
 *     is the bundle entry point; see bundleEditorJs() below)
 *
 * The page's markup lives in React components instead
 * (demo/components/editor-page.tsx and the editor-topbar/editor-panels
 * files it composes) — editor/html/ is gone as of #589.
 *
 * This imports packages/core/src/theme.ts (and bundles src/browser.ts) by relative path
 * rather than through the published package — a deliberate, accepted
 * pattern here, not a gap to fix. See
 * docs/decisions/editor-in-repo-module.md.
 *
 * The document shell (nav, hero, feature strip, footer) is rendered
 * through demo/components/editor-page.tsx via react-dom/server's
 * `renderToStaticMarkup`, same as every other page. #423 ported that
 * shell; #589 finished the job for the topbar/panels; #806 replaced the
 * old raw `dangerouslySetInnerHTML` splice with a real
 * server-render-then-hydrate boundary (`<EditorAppIsland>`, hydrated by
 * demo/editor-client.tsx) — see demo/components/editor-app.tsx's header
 * comment. The remaining 15 legacy `editor/js/*.js` modules (18 minus
 * zoom.ts/pan.ts/resize.ts, moved to React state by #807) (#766 converted these
 * from fixed-order string concatenation to real TS modules with explicit
 * imports) still run as their own separately-bundled script, unchanged in
 * behavior, layered on *after* hydration — see generateEditorHtml() below
 * for why the script order is load-bearing. See
 * docs/decisions/react-site-migration-plan.md.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { createElement } from 'react'
import { bundleForBrowser } from './scripts/vite-bundle.ts'
import { EditorPage } from './demo/components/editor-page.tsx'
import { type EditorThemeItem } from './demo/components/editor-topbar.tsx'
import { renderHtmlDocument } from './demo/render-html.ts'
import { THEMES } from '@zombie-mermaid/core'
import { THEME_LABELS } from './demo/theme-labels.ts'
import { chromeThemeColorsScript } from './demo/chrome-theme-data.ts'

// #688: THEME_LABELS used to be a second copy of demo/theme-labels.ts's
// export, kept in sync only by a build-time guard here that threw if
// THEMES gained a key missing from this local map. Importing the shared
// source directly removes the duplication (and the guard along with it —
// a real TypeScript import can't silently drift the way a hand-copied
// object literal could).

// ── File helpers ──────────────────────────────────────────────────────────────

const editorDir = new URL('./editor/', import.meta.url).pathname

async function readEditorFile(relativePath: string): Promise<string> {
  return readFile(editorDir + relativePath, 'utf-8')
}

async function readCssFiles(): Promise<string> {
  const order = [
    'css/variables.css',
    'css/topbar.css',
    'css/panels.css',
    'css/code-editor.css',
    'css/preview.css',
    'css/config-panel.css',
    'css/color-picker.css',
    'css/font-picker.css',
    'css/export.css',
    'css/misc.css',
  ]
  const parts = await Promise.all(order.map((f) => readEditorFile(f)))
  return parts.join('\n\n')
}

/**
 * Bundle editor/js/index.ts -- the live editor's client-side modules,
 * converted from fixed-order concatenated `editor/js/*.js` files to real
 * TS modules with explicit imports/exports by zombie-mermaid#766 (#744
 * previously only documented the load-order graph this replaces).
 *
 * `treeshake: false`: these modules exist to run for their top-level side
 * effects (DOM lookups, `addEventListener` registration), not to export a
 * computed value the entry point consumes -- see bundleForBrowser's own
 * `treeshake` option doc for why that needs tree-shaking off rather than
 * relying on per-module side-effect analysis. `minify: false` keeps it
 * readable in devtools, matching the previous raw-concatenation output.
 */
async function bundleEditorJs(): Promise<string> {
  return bundleForBrowser(
    new URL('./editor/js/index.ts', import.meta.url).pathname,
    { minify: false, treeshake: false },
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

/** Bundle src/browser.ts for the browser via Vite's build() API. */
async function bundleBrowserScript(): Promise<string> {
  try {
    return await bundleForBrowser(
      new URL('./src/browser.ts', import.meta.url).pathname,
      { minify: true },
    )
  } catch (err) {
    console.error('Bundle failed:', err)
    process.exit(1)
  }
}

/**
 * Bundle demo/editor-theme-state-bridge.ts, which exposes demo/theme-
 * state.ts's getTheme()/setTheme()/subscribe() as window.__themeState for
 * editor/js/init.ts (whose own module graph is bundled separately by
 * bundleEditorJs() below and does not import this bridge directly — it
 * reaches it only via the `window.__themeState` global, same as it always
 * has) to call — see that bridge's own header comment. #688.
 *
 * Wrapped in an IIFE: Vite/Rollup's minified ESM output for a
 * fully-self-contained bundle (no import/export statements left — every
 * dependency here is a local relative file, already inlined) is still a
 * flat sequence of top-level `var`/`function`/`const` declarations, not
 * scoped to anything. bundleBrowserScript()'s own bundle (src/browser.ts)
 * is exactly the same shape and lands in the *same* `<script type="module">`
 * tag (see generateEditorHtml() below) — two independently-minified
 * bundles concatenated as plain text will pick colliding short names
 * (`var t`, `function t()`, …) for unrelated top-level bindings and throw
 * a `SyntaxError: Identifier 't' has already been declared` at parse
 * time. The IIFE gives this bundle its own function scope so nothing it
 * declares internally can collide with bundleJs's or appJs's — the only
 * thing it needs to expose outside that scope, `window.__themeState`, is
 * already a property access, not a declaration.
 */
async function bundleThemeStateBridge(): Promise<string> {
  const bundled = await bundleForBrowser(
    new URL('./demo/editor-theme-state-bridge.ts', import.meta.url).pathname,
    { minify: true },
  )
  return `;(function () {\n${bundled}\n})();`
}

/**
 * Bundle demo/editor-client.tsx (zombie-mermaid#806) — hydrates
 * `<EditorApp>` and `<NavIsland>`. `minify: true` matches
 * dashboard.ts's/fork-fixes.ts's own hydration-entry bundles: this is the
 * first editor.ts bundle to include `react`/`react-dom/client`, and the
 * #797 epic issue's accepted bundle-size baseline was measured against a
 * minified build (see dashboard.ts's `bundleDashboardClient()` doc comment
 * for the measured unminified-vs-minified difference).
 */
async function bundleEditorClient(): Promise<string> {
  return bundleForBrowser(
    new URL('./demo/editor-client.tsx', import.meta.url).pathname,
    { minify: true },
  )
}

/**
 * Renders editor.html's three scripts and assembles the final document.
 *
 * The three scripts **must** stay in this order — see
 * demo/components/editor-page.tsx's header comment and
 * demo/editor-client.tsx's header comment for why this isn't just a
 * convention: `editorClientScript` needs to hydrate `<EditorApp>` against
 * pristine, server-rendered markup before `appJs`'s legacy `init.ts` gets
 * a chance to mutate DOM inside that same hydration boundary (initial
 * textarea value, line numbers, dark-mode icon state, first render). All
 * three are `type="module"`, so document order is execution order —
 * EditorPage renders them in exactly the order this function returns them.
 */
async function generateEditorHtml(): Promise<string> {
  const [bundleJs, themeStateBridgeJs, editorClientScript] = await Promise.all([
    bundleBrowserScript(),
    bundleThemeStateBridge(),
    bundleEditorClient(),
  ])
  console.log(`Browser bundle: ${(bundleJs.length / 1024).toFixed(1)} KB`)

  const themes: EditorThemeItem[] = Object.keys(THEMES).map((key) => ({
    key,
    bg: THEMES[key]!.bg,
    label: THEME_LABELS[key] ?? key,
  }))

  const [css, appJs] = await Promise.all([readCssFiles(), bundleEditorJs()])

  // window.__themeColors: the bg/fg table demo/editor-client.tsx's
  // initChromeTheme() call needs to re-theme Nav/Footer/the hero on this
  // page. Every other page generator gets this for free from
  // ThemePickerSection (demo/components/theme-picker-section.tsx); this
  // page has no theme-picker section of its own (its 15-theme control
  // lives in EditorTopbar instead), so it's embedded directly here, ahead
  // of editorClientScript in the same rendererSetupJs script — see this
  // function's own doc comment for why script order here is load-bearing.
  const themeColorsJs = chromeThemeColorsScript()

  return renderHtmlDocument(
    createElement(EditorPage, {
      css,
      themes,
      rendererSetupJs: `${themeColorsJs}\n\n${bundleJs}\n\n${themeStateBridgeJs}\n`,
      editorClientScript,
      appJs,
    }),
  )
}

const result = await generateEditorHtml()
const outPath = new URL('./editor.html', import.meta.url).pathname
await writeFile(outPath, result)
console.log(`Written to ${outPath} (${(result.length / 1024).toFixed(1)} KB)`)
