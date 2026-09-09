/**
 * Bridges `demo/theme-state.ts`'s `getTheme()`/`setTheme()`/`subscribe()`
 * onto `window.__themeState` for `editor/js/init.js` to call.
 *
 * `editor/js/*.js` is plain, `var`/`function`-scoped script (see
 * `editor.ts`'s `readJsFiles()` doc comment) concatenated verbatim into
 * the editor's single `<script type="module">` tag -- it is not itself an
 * ES module and cannot use `import`. This mirrors the existing bridge
 * pattern `src/browser.ts` already uses for the same reason: it attaches
 * `window.__mermaid = { THEMES, ... }`, and `editor/js/state.js`'s very
 * first line reads `var THEMES = window.__mermaid.THEMES`. This module is
 * the same idea for the shared theme-state module (#684-#690's theme
 * selector restoration), which `src/browser.ts` itself must not depend on
 * -- that file bundles into the *published* `zombie-mermaid` package,
 * while `demo/theme-state.ts` is demo-site-only UI state with no reason to
 * ship to library consumers.
 *
 * #688's reconciliation decision (`docs/decisions/theme-selector-shared-
 * state.md`'s amendment): the editor's preview-pane theme now persists
 * through this same shared `mermaid-theme` key, not its own separate
 * `bm-editor-theme` key -- "which of the 15 built-in themes to render
 * with" is the same concept everywhere on the site, editor included, and
 * unifying it is the actual point of the #684 restoration. This does NOT
 * touch `bm-editor-dark` (`editor/js/dark-mode.js`'s own, unrelated
 * IDE-chrome light/dark toggle).
 */
import { getTheme, setTheme, subscribe } from './theme-state.ts'

declare global {
  interface Window {
    __themeState: {
      getTheme: typeof getTheme
      setTheme: typeof setTheme
      subscribe: typeof subscribe
    }
  }
}

window.__themeState = { getTheme, setTheme, subscribe }
