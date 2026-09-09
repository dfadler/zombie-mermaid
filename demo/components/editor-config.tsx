/** @jsxRuntime automatic */
/**
 * Color picker, font picker, and config panel as React components
 * (zombie-mermaid#808) -- the editor's configuration-surface slice of the
 * #797 editor rewrite. Replaces `editor/js/config-panel.ts`,
 * `editor/js/color-picker.ts`, and `editor/js/font-picker.ts` (all three
 * deleted by this issue) with {@link ConfigPanel}, called directly from
 * `editor-panels.tsx`'s `EditorLeftPanel` in place of the static
 * `ColorField`/`PaddingField` markup + `#color-popup`/`#font-popup` divs
 * those legacy modules used to wire up imperatively.
 *
 * Unlike `editor-viewport.ts`'s {@link useEditorViewport} (zombie-mermaid#807,
 * a hook with no mounted component of its own, since zoom/pan/resize only
 * ever attach listeners to elements *other* already-shipped components
 * render), this issue's own scope note says to convert these three modules
 * "to React components with local state" -- so {@link ConfigPanel} is a
 * real, always-mounted component owning the config-view markup, the shared
 * color popup, and the font popup as one subtree, not just a hook wired
 * onto someone else's markup.
 *
 * ## What's lifted into `<EditorApp>`'s reducer vs. kept local
 *
 * Only the fields `editor/js/rendering.ts` (not ported until #810) actually
 * needs to read -- colors, font, padding, edge/node stroke -- are lifted
 * into `editor-app.tsx`'s `EditorState`/`EditorAction`/`editorReducer`
 * (mirroring #807's own "Config fields" reducer block). Everything else
 * (which color-popup key is open, the font popup's open/search state, the
 * in-progress hex-input text before it resolves to a valid color) is
 * ordinary component-local `useState` here -- nothing outside this
 * component's own subtree ever reads it, so lifting it further would just
 * be unnecessary reducer surface.
 *
 * ## The `window.__editorConfigState` bridge
 *
 * `editor/js/rendering.ts`'s `buildOptions()` used to read `state.config`
 * (a module-level object `editor/js/config-panel.ts`'s `readConfig()`
 * wrote) directly, and its `doRender()` called `config-panel.ts`'s
 * `applyStrokeOverrides()` on the freshly-rendered SVG. Now that colors/
 * font/padding/edge-stroke/node-stroke are React state owned by
 * `<EditorApp>`'s reducer, `rendering.ts` -- a plain script with no access
 * to React state or context -- can't reach them directly. {@link
 * useEditorConfig} instead exposes a minimal bridge on
 * `window.__editorConfigState`, mirroring the existing `window.__mermaid` /
 * `window.__themeState` / `window.__editorViewportState` convention (see
 * `editor-viewport.ts`'s identical header-comment section for the same
 * bridge, one issue earlier): `rendering.ts` calls
 * `window.__editorConfigState.getConfig()` instead of reading `state.config`,
 * and `window.__editorConfigState.applyStrokeOverrides(svgEl)` instead of
 * importing `applyStrokeOverrides` from the now-deleted `config-panel.ts`.
 * See `editor/js/global.d.ts` for that program's ambient declaration of
 * this shape.
 *
 * ## The `zm-editor-theme-changed` event -- the *reverse* direction
 *
 * A color field with no override shows the *current theme's* color as a
 * placeholder (`editor/js/config-panel.ts`'s old `getThemeColor()`/
 * `updateColorUI()`). The "current theme" here is `editor/js/state.ts`'s
 * `state.theme` -- still legacy-owned (theme selection isn't in this
 * issue's scope; see #809/#810) -- which is a genuinely *different* value
 * from the shared `window.__themeState.getTheme()` bridge's persisted
 * preference: `editor/js/dark-mode.ts`'s auto dark/light diagram theme and
 * `editor/js/sharing.ts`'s URL-hash-restored theme both write `state.theme`
 * directly, deliberately *without* going through `window.__themeState`
 * (see those files' own comments), so the shared bridge's value lags or
 * disagrees with the actual effective theme during exactly the common case
 * this component cares about (page load, before any explicit pick).
 *
 * So this needs the *opposite* direction of bridge from the ones above:
 * legacy code writes, React reads. A plain `window` `CustomEvent`
 * (`EDITOR_EFFECTIVE_THEME_EVENT`, dispatched by `editor/js/state.ts`'s
 * `setEditorTheme()` -- the only place `state.theme` is written now) is
 * used instead of a `window.__foo` bridge *object* for this one, on
 * purpose: a bridge object would have to be registered by the time this
 * component's mount effect first runs, but the legacy bundle that would
 * register it is deliberately delayed until *after* `<EditorApp>` finishes
 * its first hydration pass (`EDITOR_HYDRATED_EVENT`, see `editor-app.tsx`'s
 * header comment) -- so the object simply wouldn't exist yet. A raw
 * `addEventListener` has no such ordering requirement: this component
 * attaches its listener during the same hydration commit that fires
 * `EDITOR_HYDRATED_EVENT`, strictly *before* the legacy bundle even starts
 * loading, so every `setEditorTheme()` call the legacy bundle's own
 * top-level setup makes (dark-mode auto-select, hash restore, saved-theme
 * restore) is guaranteed to reach this listener once it happens, with no
 * "did the emitter register in time" race either direction. The event name
 * string is duplicated verbatim in `editor/js/state.ts` (not imported --
 * that file is a separate `tsc` program, see `editor/js/global.d.ts`'s
 * header comment for why) with a comment cross-referencing this one.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
} from 'react'
import type { EditorAction, EditorRefs, EditorState } from './editor-app.tsx'

/* -----------------------------------------------------------------
 * Pure helpers -- colors
 * ----------------------------------------------------------------- */

/** The six overridable color slots -- matches `editor/js/config-panel.ts`'s `cfgColors` keys exactly. */
export type ColorKey = 'bg' | 'fg' | 'accent' | 'line' | 'muted' | 'surface'

export const COLOR_KEYS: readonly ColorKey[] = [
  'bg',
  'fg',
  'accent',
  'line',
  'muted',
  'surface',
]

/** Human labels for each key -- moved verbatim from `editor/js/color-picker.ts`'s `openColorPopup()`. */
export const COLOR_LABELS: Record<ColorKey, string> = {
  bg: 'Background',
  fg: 'Foreground',
  accent: 'Accent',
  line: 'Line',
  muted: 'Muted',
  surface: 'Surface',
}

/** Moved verbatim from `editor/js/config-panel.ts` (deleted by this issue). */
export const COLOR_PRESETS: readonly string[] = [
  '#ffffff',
  '#f5f5f5',
  '#e0e0e0',
  '#bdbdbd',
  '#9e9e9e',
  '#757575',
  '#424242',
  '#212121',
  '#000000',
  '#f44336',
  '#e91e63',
  '#ff4081',
  '#ff1744',
  '#d50000',
  '#9c27b0',
  '#673ab7',
  '#3f51b5',
  '#7c4dff',
  '#aa00ff',
  '#2196f3',
  '#03a9f4',
  '#00bcd4',
  '#1565c0',
  '#2979ff',
  '#0091ea',
  '#4caf50',
  '#8bc34a',
  '#009688',
  '#00e676',
  '#1b5e20',
  '#ffeb3b',
  '#ffc107',
  '#ff9800',
  '#ff5722',
  '#ff6d00',
  '#0f1117',
  '#161b22',
  '#1c2128',
  '#0d1117',
  '#1a1a2e',
  '#16213e',
]

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value)
}

/** The color-per-theme shape `window.__mermaid.THEMES` entries have (mirrors `editor/js/global.d.ts`'s `EditorMermaidTheme`, duplicated for the same "separate tsc program" reason that file documents). */
export interface EditorThemeColors {
  bg: string
  fg: string
  line?: string
  accent?: string
  muted?: string
  surface?: string
  border?: string
}

const THEME_COLOR_MAP: Record<ColorKey, keyof EditorThemeColors> = {
  bg: 'bg',
  fg: 'fg',
  accent: 'accent',
  line: 'line',
  muted: 'muted',
  surface: 'surface',
}

/**
 * Moved from `editor/js/config-panel.ts`'s `getThemeColor()`. `themes` is
 * `window.__mermaid.THEMES` (undefined under SSR/before the renderer
 * bundle has loaded) and `themeKey` is the *effective* current theme -- see
 * this file's header comment on why that isn't simply
 * `window.__themeState.getTheme()`.
 */
export function getEffectiveThemeColor(
  themes: Record<string, EditorThemeColors> | undefined,
  themeKey: string,
  key: ColorKey,
): string | null {
  const theme = themeKey ? themes?.[themeKey] : undefined
  if (!theme) return null
  return theme[THEME_COLOR_MAP[key]] || null
}

/* -----------------------------------------------------------------
 * Pure helpers -- fonts
 * ----------------------------------------------------------------- */

export interface PresetFont {
  name: string
  value: string
  group: string
}

/** Moved verbatim from `editor/js/font-picker.ts` (deleted by this issue). */
export const PRESET_FONTS: readonly PresetFont[] = [
  { name: 'Inter', value: 'Inter', group: 'Sans-serif' },
  { name: 'Geist', value: 'Geist', group: 'Sans-serif' },
  { name: 'Roboto', value: 'Roboto', group: 'Sans-serif' },
  { name: 'Open Sans', value: 'Open Sans', group: 'Sans-serif' },
  { name: 'Lato', value: 'Lato', group: 'Sans-serif' },
  { name: 'Poppins', value: 'Poppins', group: 'Sans-serif' },
  { name: 'Nunito', value: 'Nunito', group: 'Sans-serif' },
  { name: 'DM Sans', value: 'DM Sans', group: 'Sans-serif' },
  { name: 'Space Grotesk', value: 'Space Grotesk', group: 'Sans-serif' },
  { name: 'Arial', value: 'Arial', group: 'System' },
  { name: 'Georgia', value: 'Georgia', group: 'Serif' },
  { name: 'Merriweather', value: 'Merriweather', group: 'Serif' },
  { name: 'Playfair Display', value: 'Playfair Display', group: 'Serif' },
  { name: 'JetBrains Mono', value: 'JetBrains Mono', group: 'Monospace' },
  { name: 'Fira Code', value: 'Fira Code', group: 'Monospace' },
  { name: 'Source Code Pro', value: 'Source Code Pro', group: 'Monospace' },
  { name: 'Courier New', value: 'Courier New', group: 'Monospace' },
]

/** `''` (no override) displays as "Default", matching the static markup's original label. */
export function getFontDisplayLabel(font: string): string {
  if (!font) return 'Default'
  return PRESET_FONTS.find((f) => f.value === font)?.name ?? font
}

/**
 * Fonts the browser already has loaded, beyond the curated preset list --
 * moved from `editor/js/font-picker.ts`'s `buildFontList()`. Guarded the
 * same way that file was: `document.fonts` isn't guaranteed to exist in
 * every environment (also false under SSR, where `document` itself doesn't
 * exist -- callers must only invoke this client-side).
 */
export function getBrowserLoadedFontNames(query: string): string[] {
  const q = query.toLowerCase()
  let names: string[] = []
  try {
    document.fonts.forEach((ff) => {
      const n = ff.family.replace(/['"]/g, '')
      if (!q || n.toLowerCase().includes(q)) names.push(n)
    })
    names = [...new Set(names)].sort()
  } catch {
    // document.fonts isn't guaranteed to exist in every environment.
  }
  return names
}

/* -----------------------------------------------------------------
 * Pure helpers -- padding / stroke / merged config
 * ----------------------------------------------------------------- */

export const PADDING_MIN = 0
export const PADDING_MAX = 120
export const DEFAULT_PADDING = 24

export function clampPadding(value: number): number {
  return Math.max(PADDING_MIN, Math.min(PADDING_MAX, Math.round(value)))
}

export const STROKE_MIN = 0.25
export const STROKE_MAX = 6
export const STROKE_STEP = 0.25
export const DEFAULT_STROKE = 1

/** Mirrors `editor/js/config-panel.ts`'s `makeStrokeSetter()`'s clamp + quarter-step rounding. */
export function clampStroke(value: number): number {
  const clamped = Math.max(STROKE_MIN, Math.min(STROKE_MAX, value))
  return Math.round(clamped * 4) / 4
}

/**
 * Moved from `editor/js/config-panel.ts`'s `readConfig()` -- only
 * overridden fields are included, so an unmodified color/font/padding
 * falls through to the active theme's own value in
 * `editor/js/rendering.ts`'s `buildOptions()` (which merges the theme's
 * colors first, then `Object.assign`s this on top -- config always wins).
 */
export function computeConfig(
  colors: Record<ColorKey, string>,
  font: string,
  padding: number,
): Record<string, unknown> {
  const cfg: Record<string, unknown> = {}
  for (const key of COLOR_KEYS) {
    if (colors[key]) cfg[key] = colors[key]
  }
  if (font) cfg.font = font
  if (padding !== DEFAULT_PADDING) cfg.padding = padding
  return cfg
}

/**
 * Moved verbatim (minus the module-level `cfgEdgeStroke`/`cfgNodeStroke`
 * reads, now parameters) from `editor/js/config-panel.ts`'s
 * `applyStrokeOverrides()`.
 */
export function applyStrokeOverridesToSvg(
  svgEl: SVGSVGElement | null,
  edgeStroke: number,
  nodeStroke: number,
): void {
  if (!svgEl) return
  const defsEl = svgEl.querySelector('defs')

  function inDefs(el: Element): boolean {
    return !!defsEl && defsEl.contains(el)
  }

  if (edgeStroke !== DEFAULT_STROKE) {
    const ew = String(edgeStroke)
    svgEl
      .querySelectorAll('line, path[fill="none"], polyline[fill="none"]')
      .forEach((el) => {
        if (!inDefs(el)) el.setAttribute('stroke-width', ew)
      })
    const arrowFactor = Math.sqrt(edgeStroke)
    svgEl.querySelectorAll('defs marker').forEach((marker) => {
      const origW = parseFloat(marker.getAttribute('markerWidth') || '8')
      const origH = parseFloat(marker.getAttribute('markerHeight') || '5')
      marker.setAttribute('viewBox', '0 0 ' + origW + ' ' + origH)
      marker.setAttribute('markerUnits', 'userSpaceOnUse')
      marker.setAttribute('markerWidth', String(origW * arrowFactor))
      marker.setAttribute('markerHeight', String(origH * arrowFactor))
    })
  }

  if (nodeStroke !== DEFAULT_STROKE) {
    const nw = String(nodeStroke)
    svgEl.querySelectorAll('rect, ellipse, circle, polygon').forEach((el) => {
      if (!inDefs(el)) el.setAttribute('stroke-width', nw)
    })
  }
}

/* -----------------------------------------------------------------
 * window.__editorConfigState bridge (React writes, legacy reads)
 * ----------------------------------------------------------------- */

declare global {
  interface Window {
    __editorConfigState: {
      getConfig(): Record<string, unknown>
      applyStrokeOverrides(svgEl: SVGSVGElement | null): void
    }
    /**
     * The *reverse* direction -- registered by `editor/js/rendering.ts`
     * itself, called from this file's `ConfigPanel` (via `?.`, not a plain
     * call) whenever a color/font/padding change needs to trigger a new
     * render. See `editor/js/rendering.ts`'s own registration comment for
     * the full rationale, including why this one's optional here but not
     * on that program's own ambient declaration
     * (`editor/js/global.d.ts`'s `EditorRenderTriggerBridge`).
     */
    __editorRenderTrigger?: { scheduleRender(delay?: number): void }
  }
}

/** Constructor args for {@link useEditorConfig} -- `state`/`refs` `<EditorApp>` already holds locally in its own body. */
export interface UseEditorConfigArgs {
  state: EditorState
  refs: { current: EditorRefs | null }
}

/**
 * Registers `window.__editorConfigState` for `editor/js/rendering.ts` to
 * call -- see this file's header comment. Call once, unconditionally, from
 * `<EditorApp>`'s own body (mirrors `editor-viewport.ts`'s
 * `useEditorViewport`).
 *
 * Also re-applies edge/node stroke overrides directly to the *currently
 * rendered* SVG whenever `state.edgeStroke`/`state.nodeStroke` change --
 * mirrors `editor/js/config-panel.ts`'s old `makeStrokeSetter()`, which
 * mutated the live SVG synchronously rather than triggering a full
 * `scheduleRender()` (stroke width is applied post-render, not baked into
 * `renderMermaid`'s own options, so a full re-render isn't needed here the
 * way it is for a color/font/padding change -- see `ConfigPanel`'s own
 * handlers for those). The same `editor-viewport.ts` "state-keyed effect,
 * not called from inside the event handler that dispatched it" pattern
 * `applyZoomToDom`'s own effect uses, for the same reason: `refs.current`
 * (a plain ref, not context) and `state` are only guaranteed fresh once
 * React has actually re-rendered, which a dispatch doesn't do
 * synchronously.
 */
export function useEditorConfig({ state, refs }: UseEditorConfigArgs): void {
  const stateRef = useRef(state)
  stateRef.current = state

  useLayoutEffect(() => {
    window.__editorConfigState = {
      getConfig: () => stateRef.current.config,
      applyStrokeOverrides: (svgEl) =>
        applyStrokeOverridesToSvg(
          svgEl,
          stateRef.current.edgeStroke,
          stateRef.current.nodeStroke,
        ),
    }
  }, [])

  useLayoutEffect(() => {
    const svgEl = refs.current?.previewInner.querySelector('svg')
    if (svgEl) {
      applyStrokeOverridesToSvg(svgEl, state.edgeStroke, state.nodeStroke)
    }
  }, [state.edgeStroke, state.nodeStroke, refs])
}

/* -----------------------------------------------------------------
 * zm-editor-theme-changed event (legacy writes, React reads)
 * ----------------------------------------------------------------- */

/**
 * Duplicated verbatim in `editor/js/state.ts`'s `setEditorTheme()` -- see
 * this file's header comment ("The `zm-editor-theme-changed` event") for
 * why a raw window event, not a `window.__foo` bridge object, is used for
 * this one direction, and why the string can't just be imported from
 * there.
 */
export const EDITOR_EFFECTIVE_THEME_EVENT = 'zm-editor-theme-changed'

/**
 * The current *effective* editor theme key (`''` for "no theme" / default),
 * kept in sync with `editor/js/state.ts`'s `state.theme` via {@link
 * EDITOR_EFFECTIVE_THEME_EVENT} -- see this file's header comment for why
 * this can't simply be `window.__themeState.getTheme()`. Starts at `''`,
 * matching both SSR (no theme is ever picked server-side) and the client's
 * pre-hydration-legacy-bundle window.
 */
export function useEditorEffectiveTheme(): string {
  const [theme, setTheme] = useState('')
  useEffect(() => {
    function onThemeChanged(event: Event): void {
      setTheme((event as CustomEvent<string>).detail)
    }
    window.addEventListener(EDITOR_EFFECTIVE_THEME_EVENT, onThemeChanged)
    return () => {
      window.removeEventListener(EDITOR_EFFECTIVE_THEME_EVENT, onThemeChanged)
    }
  }, [])
  return theme
}

/** `window.__mermaid.THEMES`, or `undefined` before the renderer bundle has loaded (or under SSR/tests). */
function readMermaidThemes(): Record<string, EditorThemeColors> | undefined {
  if (typeof window === 'undefined') return undefined
  return (
    window as unknown as {
      __mermaid?: { THEMES: Record<string, EditorThemeColors> }
    }
  ).__mermaid?.THEMES
}

/* -----------------------------------------------------------------
 * Outside-click-closes-popup, shared by the color and font popups
 * ----------------------------------------------------------------- */

function eventTargetClosest(
  target: EventTarget | null,
  selector: string,
): Element | null {
  return target instanceof Element ? target.closest(selector) : null
}

/**
 * Closes an open popup on a click outside it -- mirrors
 * `editor/js/color-picker.ts`'s/`font-picker.ts`'s identical
 * `document.addEventListener('click', ...)` + `closest()` pattern.
 * `excludeSelector` additionally exempts the trigger button itself (its own
 * click handler already toggles the popup; without the exemption, the same
 * click would immediately re-close what it just opened, since this
 * document-level listener also fires for it).
 */
function useCloseOnOutsideClick(
  isOpen: boolean,
  popupSelector: string,
  excludeSelector: string,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!isOpen) return
    function onDocumentClick(e: MouseEvent): void {
      if (
        !eventTargetClosest(e.target, popupSelector) &&
        !eventTargetClosest(e.target, excludeSelector)
      ) {
        onClose()
      }
    }
    document.addEventListener('click', onDocumentClick)
    return () => {
      document.removeEventListener('click', onDocumentClick)
    }
  }, [isOpen, popupSelector, excludeSelector, onClose])
}

/* -----------------------------------------------------------------
 * Components
 * ----------------------------------------------------------------- */

interface PopupPosition {
  left: number
  top: number
}

/** Mirrors `editor/js/color-picker.ts`'s `openColorPopup()` position math (240px-wide popup, flips above the anchor if it would overflow the viewport bottom). */
function computeColorPopupPosition(anchorRect: DOMRect): PopupPosition {
  const pw = 240
  let left = anchorRect.right - pw
  if (left < 8) left = 8
  let top = anchorRect.bottom + 6
  if (top + 400 > window.innerHeight) top = anchorRect.top - 406
  return { left, top }
}

/** Mirrors `editor/js/font-picker.ts`'s `openFontPopup()` position math. */
function computeFontPopupPosition(anchorRect: DOMRect): PopupPosition {
  let left = anchorRect.right - 220
  if (left < 8) left = 8
  return { left, top: anchorRect.bottom + 6 }
}

function StrokeSearchIcon() {
  return (
    <svg
      className="font-search-icon"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

interface ColorFieldProps {
  colorKey: ColorKey
  override: string
  themeColor: string | null
  onOpen: (key: ColorKey, anchorEl: HTMLElement) => void
}

/** One color row in the Config tab's Colors section -- was `editor-panels.tsx`'s static `ColorField`. */
function ColorField({
  colorKey,
  override,
  themeColor,
  onOpen,
}: ColorFieldProps) {
  const effective = override || themeColor
  return (
    <div className="color-field">
      <span className="color-field-label">{COLOR_LABELS[colorKey]}</span>
      <button
        type="button"
        className="color-edit-btn"
        data-cfg={colorKey}
        title={
          override
            ? 'Override: ' + override
            : themeColor
              ? 'Theme default: ' + themeColor
              : 'Not set'
        }
        onClick={(e) => onOpen(colorKey, e.currentTarget)}
      >
        <span
          className="cfg-hex-label"
          id={`cfg-${colorKey}-label`}
          style={{ opacity: override ? 1 : 0.45 }}
        >
          {override || themeColor || '—'}
        </span>
        <span
          className="color-swatch"
          id={`cfg-${colorKey}-swatch`}
          style={{
            background: effective || 'transparent',
            border: effective
              ? '1px solid rgba(0,0,0,0.15)'
              : '1px dashed var(--fg3)',
            opacity: override ? 1 : themeColor ? 0.6 : 1,
          }}
        />
      </button>
    </div>
  )
}

interface ColorPopupProps {
  activeKey: ColorKey | null
  position: PopupPosition | null
  value: string
  hexInput: string
  onHexInputChange: (raw: string) => void
  onNativeChange: (hex: string) => void
  onPickPreset: (hex: string) => void
  onClear: () => void
  onClose: () => void
}

/** The shared color-editing popup -- was `editor-panels.tsx`'s static `#color-popup` markup, wired imperatively by `editor/js/color-picker.ts`. */
function ColorPopup({
  activeKey,
  position,
  value,
  hexInput,
  onHexInputChange,
  onNativeChange,
  onPickPreset,
  onClear,
  onClose,
}: ColorPopupProps) {
  useCloseOnOutsideClick(
    activeKey !== null,
    '#color-popup',
    '.color-edit-btn',
    onClose,
  )
  const nativeValue = isValidHexColor(value) ? value : '#ffffff'
  return (
    <div
      className={'color-popup' + (activeKey !== null ? ' open' : '')}
      id="color-popup"
      style={
        position
          ? { left: position.left + 'px', top: position.top + 'px' }
          : undefined
      }
    >
      <div className="color-popup-header">
        <span className="color-popup-title" id="color-popup-title">
          {activeKey ? COLOR_LABELS[activeKey] : 'Color'}
        </span>
        <button
          type="button"
          className="color-popup-close"
          id="color-popup-close"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="color-hex-row">
        <input
          type="color"
          className="color-native"
          id="color-native-input"
          value={nativeValue}
          onChange={(e) => onNativeChange(e.currentTarget.value)}
        />
        <input
          type="text"
          className="color-hex-input"
          id="color-hex-input"
          placeholder="#rrggbb"
          maxLength={9}
          value={hexInput}
          onChange={(e) => onHexInputChange(e.currentTarget.value)}
        />
        <button
          type="button"
          className="color-clear-btn"
          id="color-clear-btn"
          onClick={onClear}
        >
          Clear
        </button>
      </div>
      <div className="color-palette-title">Presets</div>
      <div className="color-palette" id="color-palette">
        {COLOR_PRESETS.map((hex) => (
          <button
            key={hex}
            type="button"
            className="color-swatch-btn"
            style={{ background: hex }}
            title={hex}
            onClick={() => onPickPreset(hex)}
          />
        ))}
      </div>
    </div>
  )
}

interface FontPopupProps {
  open: boolean
  search: string
  currentFont: string
  onSearchChange: (query: string) => void
  onSelect: (value: string) => void
  onClose: () => void
  position: PopupPosition | null
  searchInputRef: RefObject<HTMLInputElement | null>
}

/** The font-picker popup -- was `editor-panels.tsx`'s static `#font-popup` markup, wired imperatively by `editor/js/font-picker.ts`. */
function FontPopup({
  open,
  search,
  currentFont,
  onSearchChange,
  onSelect,
  onClose,
  position,
  searchInputRef,
}: FontPopupProps) {
  useCloseOnOutsideClick(open, '#font-popup', '#font-select-btn', onClose)
  const [browserFonts, setBrowserFonts] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setBrowserFonts(getBrowserLoadedFontNames(search))
  }, [open, search])

  // Only built while open -- matches editor/js/font-picker.ts's
  // buildFontList(), which only ever ran from openFontPopup()/the search
  // input's own listener, leaving #font-list genuinely empty in the
  // markup the rest of the time (confirmed against
  // __tests__/site-equivalence.test.ts's golden SSR snapshot, which pins
  // exactly that).
  const q = search.toLowerCase()
  const groups = new Map<string, PresetFont[]>()
  if (open) {
    const filtered = PRESET_FONTS.filter(
      (f) =>
        !q ||
        f.name.toLowerCase().includes(q) ||
        f.value.toLowerCase().includes(q),
    )
    for (const f of filtered) {
      const list = groups.get(f.group)
      if (list) list.push(f)
      else groups.set(f.group, [f])
    }
  }

  return (
    <div
      className={'font-popup' + (open ? ' open' : '')}
      id="font-popup"
      style={
        position
          ? { left: position.left + 'px', top: position.top + 'px' }
          : undefined
      }
    >
      <div className="font-search-wrap">
        <StrokeSearchIcon />
        <input
          ref={searchInputRef}
          className="font-search"
          id="font-search"
          placeholder="Quick search"
          value={search}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
        />
      </div>
      <div className="font-list" id="font-list">
        {[...groups.entries()].map(([group, fonts]) => (
          <div key={group}>
            <div className="font-section-label">{group}</div>
            {fonts.map((f) => (
              <div
                key={f.value}
                className={
                  'font-item' + (currentFont === f.value ? ' active' : '')
                }
                onClick={() => onSelect(f.value)}
              >
                <span
                  className="font-item-preview"
                  style={{ fontFamily: f.value + ', sans-serif' }}
                >
                  Aa
                </span>
                <span className="font-item-name">{f.name}</span>
              </div>
            ))}
          </div>
        ))}
        {open && browserFonts.length > 0 && (
          <div>
            <div className="font-section-label">Loaded in browser</div>
            {browserFonts.map((name) => (
              <div
                key={name}
                className={
                  'font-item' + (currentFont === name ? ' active' : '')
                }
                onClick={() => onSelect(name)}
              >
                <span
                  className="font-item-preview"
                  style={{ fontFamily: name + ', sans-serif' }}
                >
                  Aa
                </span>
                <span className="font-item-name">{name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface NumberSliderFieldProps {
  label: string
  id: string
  min: number
  max: number
  step?: number
  value: number
  onChange: (value: number) => void
}

/** A numeric field + linked range slider -- was `editor-panels.tsx`'s static `PaddingField`, reused for padding, edge stroke, and node stroke. */
function NumberSliderField({
  label,
  id,
  min,
  max,
  step,
  value,
  onChange,
}: NumberSliderFieldProps) {
  return (
    <div className="padding-field">
      <div className="padding-row">
        <label>{label}</label>
        <input
          className="padding-num"
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.currentTarget.value) || 0)}
        />
      </div>
      <input
        className="padding-slider"
        id={`${id}-slider`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.currentTarget.value) || 0)}
      />
    </div>
  )
}

export interface ConfigPanelProps {
  state: EditorState
  dispatch: Dispatch<EditorAction>
}

/**
 * The editor's config surface: the Colors/Typography/Layout sections (was
 * the static `#config-view` markup) plus the shared color and font popups
 * (was `#color-popup`/`#font-popup`) -- all three owned by one component
 * since the popups are shared, single instances that any color field or the
 * font-select button can open. Rendered from `editor-panels.tsx`'s
 * `EditorLeftPanel` in place of that static markup.
 */
export function ConfigPanel({ state, dispatch }: ConfigPanelProps) {
  const [activeColorKey, setActiveColorKey] = useState<ColorKey | null>(null)
  const [colorPopupPos, setColorPopupPos] = useState<PopupPosition | null>(null)
  const [hexInput, setHexInput] = useState('')

  const [fontPopupOpen, setFontPopupOpen] = useState(false)
  const [fontPopupPos, setFontPopupPos] = useState<PopupPosition | null>(null)
  const [fontSearch, setFontSearch] = useState('')
  const fontSearchInputRef = useRef<HTMLInputElement>(null)

  const effectiveTheme = useEditorEffectiveTheme()
  const themes = readMermaidThemes()

  const openColorPopup = useCallback(
    (key: ColorKey, anchorEl: HTMLElement) => {
      setActiveColorKey(key)
      setHexInput(state.colors[key] || '')
      setColorPopupPos(
        computeColorPopupPosition(anchorEl.getBoundingClientRect()),
      )
    },
    [state.colors],
  )

  const closeColorPopup = useCallback(() => {
    setActiveColorKey(null)
  }, [])

  const commitColor = useCallback(
    (hex: string) => {
      if (!activeColorKey) return
      dispatch({ type: 'SET_COLOR', key: activeColorKey, value: hex })
      setHexInput(hex)
      // Matches editor/js/color-picker.ts's old setActiveColor()'s
      // scheduleRender(200) -- see rendering.ts's window.__editorRenderTrigger
      // registration comment for why this needs a bridge call at all now.
      window.__editorRenderTrigger?.scheduleRender(200)
    },
    [activeColorKey, dispatch],
  )

  const handleHexInputChange = useCallback(
    (raw: string) => {
      setHexInput(raw)
      let val = raw.trim()
      if (val && !val.startsWith('#')) val = '#' + val
      if (isValidHexColor(val) && activeColorKey) {
        dispatch({ type: 'SET_COLOR', key: activeColorKey, value: val })
        // Matches editor/js/color-picker.ts's hex-input listener's
        // scheduleRender(400) -- a longer debounce than a preset/native
        // pick's 200ms, since this fires on every keystroke.
        window.__editorRenderTrigger?.scheduleRender(400)
      }
    },
    [activeColorKey, dispatch],
  )

  const handleClear = useCallback(() => {
    if (!activeColorKey) return
    dispatch({ type: 'SET_COLOR', key: activeColorKey, value: '' })
    setHexInput('')
    // Matches editor/js/color-picker.ts's clear-button listener's
    // scheduleRender(200).
    window.__editorRenderTrigger?.scheduleRender(200)
  }, [activeColorKey, dispatch])

  const openFontPopup = useCallback((anchorEl: HTMLElement) => {
    setFontSearch('')
    setFontPopupPos(computeFontPopupPosition(anchorEl.getBoundingClientRect()))
    setFontPopupOpen(true)
    // Matches editor/js/font-picker.ts's openFontPopup() focusing the
    // search field on open.
    requestAnimationFrame(() => fontSearchInputRef.current?.focus())
  }, [])

  const closeFontPopup = useCallback(() => setFontPopupOpen(false), [])

  const selectFont = useCallback(
    (value: string) => {
      dispatch({ type: 'SET_FONT', font: value })
      closeFontPopup()
      // Matches editor/js/font-picker.ts's appendFontItem() click
      // listener's scheduleRender(0) -- an immediate (next-tick) render,
      // not debounced, since picking a font is a single discrete action.
      window.__editorRenderTrigger?.scheduleRender(0)
    },
    [dispatch, closeFontPopup],
  )

  return (
    <>
      <div className="config-panel" id="config-view">
        <div className="config-section">
          <div className="config-section-title">Colors</div>
          {COLOR_KEYS.map((key) => (
            <ColorField
              key={key}
              colorKey={key}
              override={state.colors[key]}
              themeColor={getEffectiveThemeColor(themes, effectiveTheme, key)}
              onOpen={openColorPopup}
            />
          ))}
        </div>

        <div className="config-section">
          <div className="config-section-title">Typography</div>
          <div className="font-field">
            <span className="font-field-label">Font family</span>
            <button
              type="button"
              className="font-select-btn"
              id="font-select-btn"
              onClick={(e) =>
                fontPopupOpen
                  ? closeFontPopup()
                  : openFontPopup(e.currentTarget)
              }
            >
              <span id="font-select-label">
                {getFontDisplayLabel(state.font)}
              </span>
              <span className="font-select-caret">▼</span>
            </button>
          </div>
        </div>

        <div className="config-section">
          <div className="config-section-title">Layout</div>
          <NumberSliderField
            label="Padding"
            id="cfg-padding"
            min={PADDING_MIN}
            max={PADDING_MAX}
            value={state.padding}
            onChange={(v) => {
              dispatch({ type: 'SET_PADDING', padding: v })
              // Matches editor/js/config-panel.ts's old setPadding()'s
              // scheduleRender(200) -- padding is baked into
              // renderMermaid()'s own options, unlike edge/node stroke
              // below (applied post-render -- see useEditorConfig's own
              // dedicated re-apply effect for those instead).
              window.__editorRenderTrigger?.scheduleRender(200)
            }}
          />
          <NumberSliderField
            label="Edge stroke"
            id="cfg-edge-stroke"
            min={STROKE_MIN}
            max={STROKE_MAX}
            step={STROKE_STEP}
            value={state.edgeStroke}
            onChange={(v) => dispatch({ type: 'SET_EDGE_STROKE', value: v })}
          />
          <NumberSliderField
            label="Node border"
            id="cfg-node-stroke"
            min={STROKE_MIN}
            max={STROKE_MAX}
            step={STROKE_STEP}
            value={state.nodeStroke}
            onChange={(v) => dispatch({ type: 'SET_NODE_STROKE', value: v })}
          />
        </div>
      </div>

      <ColorPopup
        activeKey={activeColorKey}
        position={colorPopupPos}
        value={activeColorKey ? state.colors[activeColorKey] : ''}
        hexInput={hexInput}
        onHexInputChange={handleHexInputChange}
        onNativeChange={commitColor}
        onPickPreset={commitColor}
        onClear={handleClear}
        onClose={closeColorPopup}
      />

      <FontPopup
        open={fontPopupOpen}
        search={fontSearch}
        currentFont={state.font}
        onSearchChange={setFontSearch}
        onSelect={selectFont}
        onClose={closeFontPopup}
        position={fontPopupPos}
        searchInputRef={fontSearchInputRef}
      />
    </>
  )
}
