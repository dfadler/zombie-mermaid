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
 *   - editor/js/   — modular JS modules
 *
 * The page's markup lives in React components instead
 * (demo/components/editor-page.tsx and the editor-topbar/editor-panels
 * files it composes) — editor/html/ is gone as of #589.
 *
 * This imports src/theme.ts (and bundles src/browser.ts) by relative path
 * rather than through the published package — a deliberate, accepted
 * pattern here, not a gap to fix. See
 * docs/decisions/editor-in-repo-module.md.
 *
 * The whole page is rendered through demo/components/editor-page.tsx via
 * react-dom/server's `renderToStaticMarkup`. #423 ported the document
 * shell; #589 finished the job — the topbar and both panels are real
 * component trees now, and the only raw splice left is the inline
 * `<script type="module">`, which carries this repo's own bundled
 * renderer plus every editor/js/*.js module. See
 * docs/decisions/react-site-migration-plan.md.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { createElement } from 'react'
import { bundleForBrowser } from './scripts/vite-bundle.ts'
import { EditorPage } from './demo/components/editor-page.tsx'
import {
  EditorThemeItems,
  type EditorThemeItem,
} from './demo/components/editor-topbar.tsx'
import { renderHtmlDocument } from './demo/render-html.ts'
import { THEMES } from './src/theme.ts'

const THEME_LABELS: Record<string, string> = {
  'zinc-light': 'Zinc Light',
  'zinc-dark': 'Zinc Dark',
  'tokyo-night': 'Tokyo Night',
  'tokyo-night-storm': 'Tokyo Storm',
  'tokyo-night-light': 'Tokyo Light',
  'catppuccin-mocha': 'Catppuccin',
  'catppuccin-latte': 'Latte',
  nord: 'Nord',
  'nord-light': 'Nord Light',
  dracula: 'Dracula',
  'github-light': 'GitHub',
  'github-dark': 'GitHub Dark',
  'solarized-light': 'Solarized',
  'solarized-dark': 'Solar Dark',
  'one-dark': 'One Dark',
}

// THEME_LABELS manually shadows THEMES' keys (src/theme.ts) so the dropdown
// can show a human-friendly name instead of a raw slug. Adding a theme to
// THEMES without adding a matching entry here doesn't break the build — the
// dropdown markup below falls back to `THEME_LABELS[key] ?? key`, silently
// rendering an unlabeled slug (e.g. "nord-light" instead of "Nord Light").
// Fail loudly here instead, at generation time, so the gap gets noticed
// immediately rather than discovered later in the rendered dropdown.
const missingThemeLabels = Object.keys(THEMES).filter(
  (key) => !(key in THEME_LABELS),
)
if (missingThemeLabels.length > 0) {
  throw new Error(
    `THEME_LABELS in editor.ts is missing label(s) for: ${missingThemeLabels.join(', ')}. ` +
      'Add a human-friendly label for each new THEMES key.',
  )
}

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

async function readJsFiles(): Promise<string> {
  const order = [
    'js/helpers.js',
    'js/state.js',
    'js/elements.js',
    'js/sharing.js',
    'js/rendering.js',
    'js/zoom.js',
    'js/pan.js',
    'js/editor-helpers.js',
    'js/config-panel.js',
    'js/color-picker.js',
    'js/font-picker.js',
    'js/tabs.js',
    'js/buttons.js',
    'js/export.js',
    'js/resize.js',
    'js/toast.js',
    'js/dark-mode.js',
    'js/init.js',
  ]
  const parts = await Promise.all(order.map((f) => readEditorFile(f)))
  return parts.join('\n\n')
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

async function generateEditorHtml(): Promise<string> {
  const bundleJs = await bundleBrowserScript()
  console.log(`Browser bundle: ${(bundleJs.length / 1024).toFixed(1)} KB`)

  const themes: EditorThemeItem[] = Object.keys(THEMES).map((key) => ({
    key,
    bg: THEMES[key]!.bg,
    label: THEME_LABELS[key] ?? key,
  }))

  const [css, appJs] = await Promise.all([readCssFiles(), readJsFiles()])

  return renderHtmlDocument(
    createElement(EditorPage, {
      css,
      themeItems: createElement(EditorThemeItems, { themes }),
      scriptJs: `${bundleJs}\n\n${appJs}\n`,
    }),
  )
}

const result = await generateEditorHtml()
const outPath = new URL('./editor.html', import.meta.url).pathname
await writeFile(outPath, result)
console.log(`Written to ${outPath} (${(result.length / 1024).toFixed(1)} KB)`)
