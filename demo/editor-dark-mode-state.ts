/**
 * Single source of truth for the live editor's own dark/light chrome
 * toggle (zombie-mermaid#809) -- `editor/js/dark-mode.ts`'s old
 * `bm-editor-dark` `localStorage` key, read/written from exactly one place
 * (that module) before this issue.
 *
 * Structured after `demo/theme-state.ts`'s `getTheme()`/`setTheme()`/
 * `subscribe()` shape, per #809's own scope note ("read/write through the
 * same kind of SSR-safe state pattern theme-state.ts already establishes
 * ... rather than reinventing local-storage handling independently") --
 * but deliberately a *separate* module with its own key, not a reuse of
 * `theme-state.ts` itself. The two are genuinely different concepts:
 * `theme-state.ts`'s `mermaid-theme` key is "which of the 15 built-in
 * diagram color themes to render with," shared site-wide (editor preview
 * pane included, since #688's reconciliation -- see
 * `demo/editor-theme-state-bridge.ts`); `bm-editor-dark` is the editor
 * tool-chrome's own light/dark appearance, which only *implies* a default
 * diagram theme (`editor/js/dark-mode.ts`'s `AUTO_DARK_DIAGRAM_THEME`/
 * `AUTO_LIGHT_DIAGRAM_THEME` mapping) rather than being one. Confirmed by
 * `editor-theme-state-bridge.ts`'s own header comment, which explicitly
 * carves `bm-editor-dark` out of the #688 unification as "unrelated."
 *
 * SSR-safe for the same reason `theme-state.ts` is: `demo/components/
 * editor-app.tsx`'s `EditorApp` (which owns the actual `darkMode` reducer
 * state this module's `subscribe()` is not used to drive -- see
 * `editor-dark-mode.ts`'s header comment for why the split) is rendered
 * server-side too, via `editor-app-island.tsx`'s `renderToString()`, where
 * `window`/`localStorage` don't exist.
 */

/** The `localStorage` key this module owns. */
export const DARK_MODE_STORAGE_KEY = 'bm-editor-dark'

export type DarkModeChangeListener = (dark: boolean) => void

/** Mirrors `theme-state.ts`'s identical helper. */
function hasStorage(): boolean {
  try {
    return (
      typeof window !== 'undefined' && typeof window.localStorage === 'object'
    )
  } catch {
    return false
  }
}

/**
 * Reads the stored preference, defaulting to `false` (light mode) whenever
 * nothing is stored, storage is unavailable, or reading it throws --
 * matches `editor/js/dark-mode.ts`'s old
 * `localStorage.getItem('bm-editor-dark') === 'true'` default.
 */
export function getIsDark(): boolean {
  if (!hasStorage()) return false
  try {
    return window.localStorage.getItem(DARK_MODE_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

const listeners = new Set<DarkModeChangeListener>()

function notify(dark: boolean): void {
  for (const listener of listeners) listener(dark)
}

/**
 * Persists `dark` and notifies every subscriber in this tab synchronously,
 * regardless of whether persistence itself succeeded -- mirrors
 * `theme-state.ts`'s `setTheme()` "same-tab UI should never fall out of
 * sync with a click just because storage is full or disabled" rationale.
 */
export function setIsDark(dark: boolean): void {
  if (hasStorage()) {
    try {
      window.localStorage.setItem(
        DARK_MODE_STORAGE_KEY,
        dark ? 'true' : 'false',
      )
    } catch {
      // Ignore write failures -- notify() below still runs.
    }
  }
  notify(dark)
}

/** Registers `listener` for every dark-mode change. Returns an unsubscribe function. */
export function subscribe(listener: DarkModeChangeListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// Deliberately no `window.addEventListener('storage', ...)` cross-tab sync
// here, unlike theme-state.ts -- editor/js/dark-mode.ts never had one
// either (it read `bm-editor-dark` once at module-load time into a plain
// variable and never revisited it), so adding one now would be new
// behavior, not a preserved migration.
