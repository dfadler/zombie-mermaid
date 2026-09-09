/**
 * Single source of truth for the site-wide theme preference.
 *
 * Before this module, `demo/diagram-page-client.ts` read and wrote
 * `localStorage['mermaid-theme']` directly (and, before #716 deleted the
 * file, the pre-#590 `demo/client.ts` gallery did the same, independently).
 * Every page-client reimplemented the same three concerns -- the storage
 * key, the Default-is-an-absence-not-a-value convention, and noticing a
 * change made on another tab/page -- with no guarantee they'd stay in sync.
 * This module owns all three so a future page-client (or the shared
 * `ThemeBar`/`ThemePicker` component #686 builds) only has to call
 * `getTheme()` / `setTheme()` / `subscribe()`.
 *
 * See `docs/decisions/theme-selector-shared-state.md` for why this module
 * is shaped the way it is (the Default-vs-`zinc-light` question in
 * particular) and for the ASCII terminal-preview decision this module does
 * *not* concern itself with.
 *
 * SSR-safe: every function here is a no-op-with-a-safe-default when called
 * where `window`/`localStorage` don't exist (the page generators --
 * index.ts, pages.ts, editor.ts, etc. -- run under Node via `tsx`, not a
 * browser). A page generator that imports this module for `THEME_STORAGE_KEY`
 * or `DEFAULT_THEME_KEY` at build time will not crash; only a browser
 * page-client actually gets live values.
 */

/** The `localStorage` key every page-client reads/writes through this module. */
export const THEME_STORAGE_KEY = 'mermaid-theme'

/**
 * The "Default" pseudo-theme's sentinel value -- see
 * `docs/decisions/theme-selector-shared-state.md` for why this stays a
 * distinct concept from `'zinc-light'` rather than being collapsed into an
 * alias for it, even though the two render identically almost everywhere.
 */
export const DEFAULT_THEME_KEY = ''

export type ThemeChangeListener = (themeKey: string) => void

/**
 * `false` under SSR/build-time (page generators run under Node), and also
 * false in a browser with storage disabled/unavailable (Safari private
 * mode can throw just accessing `window.localStorage`, not only on use).
 */
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
 * Reads the stored preference, defaulting to `DEFAULT_THEME_KEY` whenever
 * nothing is stored, storage is unavailable, or reading it throws (matches
 * the existing convention in demo/diagram-page-client.ts: "no preference
 * stored" and "explicitly Default" are the same, unstored, state).
 */
export function getTheme(): string {
  if (!hasStorage()) return DEFAULT_THEME_KEY
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) ?? DEFAULT_THEME_KEY
  } catch {
    return DEFAULT_THEME_KEY
  }
}

const listeners = new Set<ThemeChangeListener>()

function notify(themeKey: string): void {
  for (const listener of listeners) listener(themeKey)
}

/**
 * Persists `themeKey` (or clears the stored preference for
 * `DEFAULT_THEME_KEY`, the same set/remove split every prior
 * implementation used) and notifies every subscriber in this tab
 * synchronously, regardless of whether persistence itself succeeded --
 * same-tab UI should never fall out of sync with a click just because
 * storage is full or disabled.
 */
export function setTheme(themeKey: string): void {
  if (hasStorage()) {
    try {
      if (themeKey) {
        window.localStorage.setItem(THEME_STORAGE_KEY, themeKey)
      } else {
        window.localStorage.removeItem(THEME_STORAGE_KEY)
      }
    } catch {
      // Ignore write failures (quota exceeded, private-mode restrictions,
      // storage disabled entirely) -- notify() below still runs, so this
      // tab's own UI stays consistent even when it can't be remembered.
    }
  }
  notify(themeKey)
}

/**
 * Registers `listener` for every theme change -- both same-tab (a
 * `setTheme()` call anywhere in this tab) and cross-tab (another tab/page
 * changing the stored preference, via the browser's `storage` event, which
 * only ever fires in *other* tabs than the one that wrote it -- see the
 * module-scope listener below). Returns an unsubscribe function.
 */
export function subscribe(listener: ThemeChangeListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// Cross-tab sync: the `storage` event fires on every *other* browsing
// context sharing this origin's localStorage when one of them changes a
// key, but never on the context that made the change -- so this only ever
// fires for a change this module's own setTheme() (in this tab) didn't
// already notify() for above.
if (hasStorage()) {
  window.addEventListener('storage', (event) => {
    if (event.key !== THEME_STORAGE_KEY) return
    notify(event.newValue ?? DEFAULT_THEME_KEY)
  })
}
