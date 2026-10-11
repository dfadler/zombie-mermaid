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
 * zombie-mermaid#935's audit confirmed this state-placement split is still
 * the right shape and left it untouched. What that audit *did* change:
 * `ColorField`, `ColorPopup`, `FontPopup`, and `NumberSliderField` were
 * independent, stateless presentational components with no dependency on
 * each other or on `ConfigPanel`'s own local state -- the same "no shared
 * state between them" pattern #932/#933 split index-app.tsx/nav.tsx's own
 * presentational components on -- so each now lives in its own file
 * (`editor-color-field.tsx`, `editor-color-popup.tsx`,
 * `editor-font-popup.tsx`, `editor-number-slider-field.tsx`), along with the
 * pure color/font/padding/stroke helpers they and `ConfigPanel` both need
 * (`editor-config-helpers.ts`, dependency-free so it can't create an import
 * cycle with any of them) and the outside-click-closes-popup hook shared by
 * the two popups (`use-close-on-outside-click.ts`). What's left here --
 * `ConfigPanel` itself, plus the two `window`-bridge sections below -- is
 * the genuinely stateful core the audit's own doc-comment note (above)
 * describes: local popup/hex-input state, and the two bridges to legacy
 * code that only this component's state can satisfy.
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
} from 'react'
import type { EditorAction, EditorRefs, EditorState } from './editor-app.tsx'
import { ColorField } from './editor-color-field.tsx'
import { ColorPopup, computeColorPopupPosition } from './editor-color-popup.tsx'
import {
  applyStrokeOverridesToSvg,
  COLOR_KEYS,
  getEffectiveThemeColor,
  getFontDisplayLabel,
  isValidHexColor,
  PADDING_MAX,
  PADDING_MIN,
  STROKE_MAX,
  STROKE_MIN,
  STROKE_STEP,
  type ColorKey,
  type EditorThemeColors,
  type PopupPosition,
} from './editor-config-helpers.ts'
import { FontPopup, computeFontPopupPosition } from './editor-font-popup.tsx'
import { NumberSliderField } from './editor-number-slider-field.tsx'

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
 * ConfigPanel
 * ----------------------------------------------------------------- */

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
