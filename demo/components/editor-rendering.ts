/**
 * The render pipeline as React state (zombie-mermaid#810) -- the last slice
 * of the #797 editor rewrite, and per that issue's own text "likely the
 * riskiest ... since it's the actual render loop." Replaces
 * `editor/js/rendering.ts` (deleted by this issue) with the pure functions
 * below plus {@link useEditorRendering}, called directly from
 * `<EditorApp>`'s own body -- the same shape `editor-viewport.ts`'s
 * `useEditorViewport` established for #807.
 *
 * ## Why the source textarea stays an uncontrolled ref, not `state`
 *
 * `editor/js/editor-helpers.ts` (not migrated by this issue -- it's also
 * used by the textarea's own `input`/`keydown` listeners there, well
 * outside this issue's three named files: `rendering.ts`, `sharing.ts`,
 * `init.ts`) still mutates `refs.editor.value` directly and imperatively --
 * the Tab-key handler's manual `.value`/`.selectionStart` rewrite in
 * particular has no equivalent as a single React state update. Making the
 * textarea a controlled input (`value={state.sourceText}`) would fight that
 * legacy code: React would revert every keystroke back to whatever
 * `state.sourceText` last was, since nothing dispatches a matching action
 * for the legacy module's own direct DOM writes. So `doRender()` below
 * reads `refs.current.editor.value` at render time, exactly like the old
 * `doRender()`'s `editor.value.trim()` did -- the source of truth is still
 * the DOM node, not reducer state. What *is* real React state now is
 * everything the render options are built from (`state.theme`,
 * `state.config`) and the trigger mechanism itself (this hook owns
 * `scheduleRender`/`doRender` instead of a plain script).
 *
 * ## The `window.__editorRenderTrigger` bridge
 *
 * Unchanged in shape from `editor/js/rendering.ts`'s own registration:
 * `demo/components/editor-config.tsx`'s `ConfigPanel` (zombie-mermaid#808)
 * already calls `window.__editorRenderTrigger?.scheduleRender(delay)`
 * whenever a color/font/padding change needs to trigger a new render, and
 * `editor/js/editor-helpers.ts` (still legacy) now calls
 * `window.__editorRenderTrigger.scheduleRender()` too, in place of the
 * direct `import { scheduleRender } from './rendering.ts'` it used before
 * this issue deleted that file. See `editor/js/global.d.ts` for that
 * program's ambient declaration of this shape, unchanged.
 *
 * ## What reads `window.__editorConfigState`/`__editorViewportState`/`__editorDarkModeState` directly instead of `state`
 *
 * `applyStrokeOverrides(svgEl)` and `applyZoom()` are DOM-mutation closures
 * owned by `editor-config.tsx`'s/`editor-viewport.ts`'s own hooks (they
 * close over refs/state this hook doesn't have direct access to without
 * duplicating them) -- {@link doRender} keeps calling them through the
 * existing bridges rather than reimplementing them here, exactly the shape
 * the old `rendering.ts` established one issue earlier. `buildOptions`
 * below, by contrast, reads `state.config` directly (no
 * `window.__editorConfigState.getConfig()` call) -- unlike stroke
 * overrides/zoom, the *merged* config object is now just an ordinary field
 * on the same `EditorState` this hook already receives, so there is nothing
 * left for that particular bridge method to do that a plain field read
 * doesn't already cover more simply. (`window.__editorConfigState.getConfig`
 * itself is left in place, unused, in `editor-config.tsx` -- not worth
 * touching that already-shipped, already-tested file just to delete a
 * harmless dead export.)
 */
import { useLayoutEffect, useRef } from 'react'
import type { EditorRefs, EditorState } from './editor-app.tsx'
import { updateUrlHash } from './editor-sharing.ts'

declare global {
  interface Window {
    // Optional -- mirrors editor-config.tsx's identical declaration of this
    // same bridge (TS requires every merged declaration of one ambient
    // `Window` member to share identical modifiers). editor-helpers.ts
    // (still legacy) always finds it populated in practice: this bridge is
    // registered by useEditorRendering's own mount-time layout effect,
    // which has already run by the time that program's bundle even starts
    // loading -- see this file's/editor-helpers.ts's header comments.
    __editorRenderTrigger?: { scheduleRender(delay?: number): void }
  }
}

export interface EditorMermaidTheme {
  bg: string
  fg: string
  line?: string
  accent?: string
  muted?: string
  surface?: string
  border?: string
}

interface EditorMermaidBridge {
  THEMES: Record<string, EditorMermaidTheme>
  renderMermaidSVGAsync: (
    source: string,
    options: Record<string, unknown>,
  ) => Promise<string>
}

/** `window.__mermaid`, typed -- `src/browser.ts` attaches it at runtime with no ambient type in `demo/`'s own tsconfig (deliberately: that program bundles into the *published* package, see `editor/js/global.d.ts`'s historical note on the same split). Mirrors `editor-config.tsx`'s identical local-cast pattern. */
function getMermaidBridge(): EditorMermaidBridge | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as { __mermaid?: EditorMermaidBridge }).__mermaid
}

/** `window.__mermaid.THEMES`, or `undefined` under SSR/tests/before the renderer bundle has loaded -- mirrors `editor-config.tsx`'s identical `readMermaidThemes()`. */
export function readMermaidThemes():
  Record<string, EditorMermaidTheme> | undefined {
  return getMermaidBridge()?.THEMES
}

export interface Rgb {
  r: number
  g: number
  b: number
}

/** Moved verbatim from `editor/js/rendering.ts` (deleted by this issue). */
export function hexToRgb(hex: string | null | undefined): Rgb | null {
  if (!hex || typeof hex !== 'string') return null
  let v = hex.trim()
  if (v[0] === '#') v = v.slice(1)
  if (v.length === 3)
    v =
      v.charAt(0) +
      v.charAt(0) +
      v.charAt(1) +
      v.charAt(1) +
      v.charAt(2) +
      v.charAt(2)
  if (v.length !== 6) return null
  const n = parseInt(v, 16)
  if (isNaN(n)) return null
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** Small, local re-implementation of `editor/js/helpers.ts`'s `escHtml` -- see `editor-app.tsx`'s `requireEditorElement` doc comment for why `demo/components/*.ts` doesn't import from `editor/js/*.ts`. */
export function escHtml(s: unknown): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Moved from `editor/js/rendering.ts`'s `applyThemeToPage()`, minus the
 * `state`/`THEMES` module-level reads (now a `themeKey` parameter and
 * {@link readMermaidThemes}).
 */
export function applyThemeToPage(themeKey: string): void {
  const root = document.documentElement
  const themes = readMermaidThemes()
  const t = themeKey ? themes?.[themeKey] : undefined
  if (t) {
    root.style.setProperty('--t-bg', t.bg)
    root.style.setProperty('--t-fg', t.fg)
    root.style.setProperty('--t-accent', t.accent || '#3b82f6')
  } else {
    const dark = window.__editorDarkModeState.getIsDark()
    root.style.setProperty('--t-bg', dark ? '#18181B' : '#FFFFFF')
    root.style.setProperty('--t-fg', dark ? '#FAFAFA' : '#27272A')
    root.style.setProperty('--t-accent', dark ? '#60a5fa' : '#3b82f6')
  }
  const fg = root.style.getPropertyValue('--t-fg').trim() || '#27272A'
  const rgb = hexToRgb(fg)
  if (rgb) {
    root.style.setProperty(
      '--foreground-rgb',
      rgb.r + ', ' + rgb.g + ', ' + rgb.b,
    )
    const bgRgb = hexToRgb(root.style.getPropertyValue('--t-bg').trim())
    const brightness = bgRgb
      ? (bgRgb.r * 299 + bgRgb.g * 587 + bgRgb.b * 114) / 1000
      : 255
    const dark = brightness < 140
    root.style.setProperty('--shadow-border-opacity', dark ? '0.15' : '0.08')
    root.style.setProperty('--shadow-blur-opacity', dark ? '0.12' : '0.06')
  }
}

/**
 * Moved from `editor/js/rendering.ts`'s `buildOptions()` -- `themes`/`state`
 * are now parameters (instead of module-level `THEMES`/`state` reads) so
 * this stays directly unit-testable without a DOM, mirroring
 * `editor-config.tsx`'s `getEffectiveThemeColor(themes, themeKey, key)`.
 * Reads `state.config` directly rather than through
 * `window.__editorConfigState.getConfig()` -- see this file's header
 * comment.
 */
export function buildOptions(
  themes: Record<string, EditorMermaidTheme> | undefined,
  state: Pick<EditorState, 'theme' | 'config'>,
): Record<string, unknown> {
  const opts: Record<string, unknown> = {}
  const t = state.theme ? themes?.[state.theme] : undefined
  if (t) {
    opts.bg = t.bg
    opts.fg = t.fg
    if (t.line) opts.line = t.line
    if (t.accent) opts.accent = t.accent
    if (t.muted) opts.muted = t.muted
    if (t.surface) opts.surface = t.surface
    if (t.border) opts.border = t.border
  }
  return Object.assign(opts, state.config)
}

/**
 * Moved from `editor/js/rendering.ts`'s `doRender()` -- `refs`/`state` are
 * now parameters read fresh at call time (this is invoked from inside a
 * `setTimeout` callback, well after the render that scheduled it), instead
 * of the old module-level `editor`/`state` object reads.
 */
export async function doRender(
  refs: EditorRefs,
  state: EditorState,
): Promise<void> {
  const source = refs.editor.value.trim()
  if (!source) {
    refs.previewInner.innerHTML =
      '<div class="preview-placeholder">Start typing to render your diagram</div>'
    refs.statusText.textContent = 'Ready'
    refs.statusText.className = ''
    refs.statusDot.className = 'status-dot'
    refs.renderTime.textContent = ''
    return
  }

  // Defensive no-op, not part of editor/js/rendering.ts's original
  // behavior: window.__mermaid is always present by the time this runs in
  // a real browser (src/browser.ts's script tag executes before
  // <EditorApp>'s own -- see editor.ts's generateEditorHtml() doc comment
  // on script order), so this branch is unreachable in production. It
  // exists purely so a real `setTimeout`-scheduled render triggered by
  // mount/bootstrap (this hook's own theme-change effect, or
  // editor-theme.ts's bootstrap effect) can't land mid-test in an RTL file
  // that mounts <EditorApp> without caring about rendering and so never
  // stubs `window.__mermaid` (most of them -- only files that actually
  // exercise the render pipeline need to). Silently doing nothing here
  // (rather than falling through to the catch block below and writing an
  // "Error" status) keeps those files' own DOM assertions free of a
  // nondeterministic race against this timer.
  const mermaid = getMermaidBridge()
  if (!mermaid) return

  refs.spinner.classList.add('visible')
  const t0 = performance.now()

  try {
    const svg = await mermaid.renderMermaidSVGAsync(
      source,
      buildOptions(mermaid.THEMES, state),
    )
    const ms = (performance.now() - t0).toFixed(0)
    refs.previewInner.innerHTML = svg
    const svgEl = refs.previewInner.querySelector('svg')
    window.__editorConfigState.applyStrokeOverrides(svgEl)
    window.__editorViewportState.applyZoom()
    refs.statusText.textContent = 'OK'
    refs.statusText.className = 'status-ok'
    refs.statusDot.className = 'status-dot ok'
    refs.renderTime.textContent = 'Rendered in ' + ms + 'ms'
    updateUrlHash(refs.editor.value, state.theme)
  } catch (err) {
    refs.previewInner.innerHTML =
      '<div class="preview-error">' + escHtml(String(err)) + '</div>'
    refs.statusText.textContent = 'Error'
    refs.statusText.className = 'status-err'
    refs.statusDot.className = 'status-dot err'
    refs.renderTime.textContent = ''
  } finally {
    refs.spinner.classList.remove('visible')
  }
}

export interface UseEditorRenderingArgs {
  state: EditorState
  refs: { current: EditorRefs | null }
}

/**
 * Owns `scheduleRender`/`doRender` and the theme-driven re-render/re-theme
 * effect -- replacing `editor/js/rendering.ts`'s module-top-level
 * equivalent. Call once, unconditionally, from `<EditorApp>`'s own body,
 * *before* `useEditorTheme` (that hook's bootstrap effect calls
 * `window.__editorRenderTrigger.scheduleRender(0)`, which must already be
 * registered).
 */
export function useEditorRendering({
  state,
  refs,
}: UseEditorRenderingArgs): void {
  const stateRef = useRef(state)
  stateRef.current = state
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stable identity (a ref, not a plain closure recreated each render) so
  // the bridge-registering effect below never needs to re-run.
  const scheduleRender = useRef((delay?: number): void => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const r = refs.current
      if (r) void doRender(r, stateRef.current)
    }, delay ?? 300)
  }).current

  useLayoutEffect(() => {
    window.__editorRenderTrigger = { scheduleRender }
  }, [scheduleRender])

  // Re-theme the page and trigger a fresh render whenever the effective
  // diagram theme changes -- editor/js/dark-mode.ts's/init.ts's old
  // scattered "setEditorTheme(...) then applyThemeToPage()+scheduleRender(0)"
  // call sites, unified into one state-keyed effect (the same pattern
  // editor-viewport.ts's zoom effect already uses). Also covers the very
  // first render on mount (an effect with a dependency array always runs
  // once on mount regardless of the dependency's value) -- editor-theme.ts's
  // bootstrap effect (which runs after this one, per <EditorApp>'s call
  // order) supersedes this call's timer with the final post-bootstrap
  // state before it ever fires, the same "multiple scheduleRender() calls
  // collapse into one final timer" behavior the old code already relied on.
  useLayoutEffect(() => {
    applyThemeToPage(state.theme)
    scheduleRender(0)
  }, [state.theme, scheduleRender])
}
