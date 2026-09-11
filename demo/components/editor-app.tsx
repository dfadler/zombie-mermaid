/** @jsxRuntime automatic */
/**
 * The live editor's hydrated root component (zombie-mermaid#806, part of
 * the #797 hydration epic) — the enabling shell the other four editor
 * sub-issues (#807-#810) build their slice on top of.
 *
 * Renders the *exact* tree `demo/components/editor-page.tsx`'s old
 * `EditorChrome` rendered (topbar, the two panels with the resize handle
 * between them, the toast) -- byte-identical markup, same ids, same
 * structure -- so this is a pure architecture change, not a visual or
 * behavioral one. What's new:
 *
 * 1. **A real state/DOM-ref core**, replacing `editor/js/state.ts` and
 *    `editor/js/elements.ts`'s module-level mutable bindings with React
 *    state and refs, exposed through {@link useEditorState}/
 *    {@link useEditorDispatch}/{@link useEditorRefs}. This is *additive* for
 *    now: none of the 18 legacy `editor/js/*.ts` modules read from it yet
 *    (see this file's own header note on why), so nothing here changes
 *    observable behavior on its own -- #807-#810 migrate one legacy
 *    concern at a time onto this foundation, each replacing that slice's
 *    own module-level state with a `dispatch` call and that slice's own
 *    `document.getElementById` calls with `useEditorRefs()`.
 * 2. **A hydration boundary** (`EDITOR_ROOT_ID`, mounted by
 *    `demo/editor-client.tsx` via `hydrateRoot()`) around exactly this
 *    markup, so the editor's chrome is a live React tree instead of static
 *    HTML with vanilla scripts bolted on afterward -- see
 *    `demo/components/editor-app-island.tsx` for the server-side half of
 *    this boundary and `demo/editor-client.tsx` for the client half.
 *
 * ## Why the legacy modules aren't migrated in this PR
 *
 * (Historical, as of #806.) `editor/js/state.ts` and `editor/js/elements.ts`
 * were the shared foundation all *other* 16 `editor/js/*.ts` modules (zoom,
 * pan, resize, config-panel, color-picker, font-picker, tabs, buttons,
 * export, toast, theme-button, dark-mode, rendering, sharing, init)
 * read/write through directly. Porting those two files' *exports* away in
 * that PR would have required migrating every module that imports them in
 * the same PR -- exactly what #806's own scope note said to avoid ("land
 * the other four editor modules as no-op stubs or leave them un-ported
 * temporarily... the goal is a working hydrated shell, not the full app in
 * one PR"). So #806 left `editor/js/state.ts`/`editor/js/elements.ts` and
 * everything downstream of them completely unchanged, still bundled and run
 * exactly as before (see `editor.ts`'s `bundleEditorJs()`) -- just *after*
 * this component finished hydrating, instead of being the only script on
 * the page. See {@link EDITOR_HYDRATED_EVENT}'s doc comment and
 * `demo/editor-client.tsx`'s header comment for why "after hydration" has
 * to mean a real completion signal, not just script tag order.
 *
 * #807 has since migrated the first slice off that legacy foundation:
 * zoom/pan/resize no longer exist as `editor/js/*.ts` modules at all --
 * `editor-viewport.ts`'s {@link useEditorViewport} (called from
 * {@link EditorApp} below) owns that state and its DOM effects now, and
 * `editor/js/rendering.ts` (still legacy, until #810) reaches the current
 * zoom level through the `window.__editorViewportState` bridge that hook
 * registers -- see that file's header comment.
 *
 * ## The refs mechanism
 *
 * {@link useEditorRefs} does not use React `ref` props threaded through
 * `EditorTopbar`/`EditorLeftPanel`/`EditorRightPanel` (which would require
 * editing those already-shipped, already-tested components just to add
 * plumbing nothing consumes yet). Instead, {@link EditorApp} looks the
 * elements up by id via `document.getElementById` in a `useLayoutEffect`
 * that runs once, immediately after this component's first commit (mirrors
 * `editor/js/elements.ts`'s own id list, and its `requireElement`'s
 * "throw immediately with the id in the message" philosophy -- see
 * {@link requireEditorElement} below) -- the same technique, just run at a
 * well-defined point in React's lifecycle instead of at module-evaluation
 * time in a hand-maintained concatenation order (the exact hazard
 * `editor/js/theme-button.ts`'s header comment documents a real bug from).
 *
 * **Ordering guarantee**: the collected refs are available to any event
 * handler or effect that fires *after* mount -- which is every legacy
 * module's own top-level `addEventListener` registration and top-level DOM
 * mutation, since none of that runs until {@link EDITOR_HYDRATED_EVENT}
 * fires (see that constant's doc comment). They are **not** guaranteed to
 * be populated inside a *descendant* component's own `useLayoutEffect`,
 * since React runs layout effects bottom-up (a child's fires before its
 * parent's) -- a descendant that needs refs at mount time should read them
 * in a plain `useEffect` instead, which fires after the whole tree
 * (including this component's layout effect) has committed.
 */
import {
  createContext,
  useContext,
  useLayoutEffect,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react'
import { useEditorButtons } from './editor-buttons.ts'
import { useEditorConfig } from './editor-config.tsx'
import { useEditorFullscreen } from './editor-fullscreen.ts'
import {
  clampPadding,
  clampStroke,
  computeConfig,
  DEFAULT_PADDING,
  DEFAULT_STROKE,
  type ColorKey,
} from './editor-config-helpers.ts'
import { useEditorExport } from './editor-export.ts'
import { EditorLeftPanel, EditorRightPanel } from './editor-panels.tsx'
import { useEditorRendering } from './editor-rendering.ts'
import { useEditorSharing } from './editor-sharing.ts'
import { useEditorTabs } from './editor-tabs.ts'
import { useEditorTheme } from './editor-theme.ts'
import { useEditorToast } from './editor-toast.ts'
import {
  EditorThemeItems,
  EditorTopbar,
  type EditorThemeItem,
} from './editor-topbar.tsx'
import { clampZoom, useEditorViewport } from './editor-viewport.ts'

/**
 * `editor-root`: id of the *hydration container* `demo/editor-client.tsx`'s
 * `hydrateRoot()` call mounts onto -- a plain wrapper `<div>`
 * `demo/components/editor-page.tsx` renders directly, not part of
 * {@link EditorApp}'s own render output. Has to be a separate element from
 * `EditorApp`'s own root for the same reason `dashboard-app.tsx`'s
 * `DASHBOARD_ROOT_ID` doc comment gives: `hydrateRoot(container, node)`
 * expects `container` to be inert and `node`'s output to match its
 * *children*, not the container itself.
 */
export const EDITOR_ROOT_ID = 'editor-root'

/**
 * `editor-props`: the `<script type="application/json">` element
 * `demo/editor-client.tsx` reads {@link EditorAppProps} out of -- the same
 * theme list `editor.ts` already builds server-side, so hydration renders
 * from identical data rather than recomputing it in the browser.
 */
export const EDITOR_PROPS_ELEMENT_ID = 'editor-props'

/**
 * `zm-editor-hydrated`: a `window` `Event` {@link EditorApp} dispatches
 * from a `useLayoutEffect`, once, right after its *first* commit --
 * `demo/editor-client.tsx` waits for this before running the legacy
 * `editor/js/*.ts` bundle, rather than relying on script tag order alone.
 *
 * **Why script order isn't enough**: `hydrateRoot()`'s initial hydration
 * pass is scheduled at idle priority, not run synchronously inside the
 * `hydrateRoot()` call itself (confirmed empirically while building this
 * PR: `<script type="module">` tags in the right document order still
 * left a real, reproducible "Hydration failed because the server rendered
 * [...] didn't match the client" error in a real browser -- see this PR's
 * description for the repro). Meanwhile several legacy modules mutate DOM
 * *inside* {@link EDITOR_ROOT_ID}'s boundary at plain module-top-level,
 * synchronously, the instant they're evaluated -- `config-panel.ts`'s
 * `refreshAllColorUIs()`, `color-picker.ts`'s preset-swatch-button
 * injection into `#color-palette`, and `init.ts`'s dark-mode/theme-button/
 * line-number writes among them. If the legacy bundle's `<script>` tag
 * simply came after the hydration one in the document, its synchronous
 * top-level code still ran to completion *before* React's own
 * idle-scheduled hydration pass got a chance to compare against pristine
 * markup -- the exact "vanilla script mutated the DOM before hydrateRoot()
 * saw it" hazard `dashboard-app.tsx`'s header comment documents for
 * `NAV_COPY_SCRIPT`, just reached via a different mechanism (scheduling,
 * not script order) this time.
 *
 * A `useLayoutEffect` only fires after its commit's DOM mutations
 * (including the hydration attach/compare, for the tree's first commit)
 * are done -- see this file's "Ordering guarantee" note above. Dispatching
 * a real event from it, and having `demo/editor-client.tsx` `await` that
 * event before even fetching the legacy bundle's code, replaces "probably
 * runs after" with "provably runs after," at the cost of the legacy bundle
 * no longer being a plain synchronously-executed `<script type="module">`
 * -- see that file's `runLegacyEditorBundle()` for how it's loaded instead.
 */
export const EDITOR_HYDRATED_EVENT = 'zm-editor-hydrated'

/**
 * `editor-legacy-app-js`: the inert `<script>` element (a `type` no
 * browser recognizes as executable, so it never auto-runs) that
 * `editor-page.tsx` embeds the legacy `editor/js/*.ts` bundle's source in.
 * `demo/editor-client.tsx`'s `runLegacyEditorBundle()` reads this element's
 * `textContent` and dynamically `import()`s it as a blob URL only after
 * {@link EDITOR_HYDRATED_EVENT} has fired -- see that constant's doc
 * comment for why a plain, immediately-executed `<script type="module">`
 * tag isn't safe here.
 */
export const EDITOR_LEGACY_APP_JS_ELEMENT_ID = 'editor-legacy-app-js'

/* -----------------------------------------------------------------
 * State core -- replaces editor/js/state.ts's module-level `state` object
 * ----------------------------------------------------------------- */

/**
 * Mirrors `editor/js/state.ts`'s `EditorState` shape exactly -- the fields
 * that already exist, not a speculative superset. #807-#810 each extend
 * this (and {@link EditorAction}) with their own slice's fields as they
 * migrate that slice's module-level state here; keeping it minimal now
 * avoids this PR carrying fields nothing reads or writes yet.
 */
export interface EditorState {
  theme: string
  zoom: number
  config: Record<string, unknown>
  /**
   * Zoom/pan/panel-resize fields below (zombie-mermaid#807) replace
   * `editor/js/zoom.ts`'s/`pan.ts`'s/`resize.ts`'s module-level mutable
   * variables (`state.zoom` -- now just `zoom` above, unclamped writes now
   * clamped in the reducer -- `panActive`, `panStart`, `isResizing`) with
   * real reducer state. See `editor-viewport.ts`'s `useEditorViewport` for
   * the effects that read/write them.
   */
  /** Whether the pan tool is toggled on (`pan-btn`'s "active" state). */
  panActive: boolean
  /** Whether a pan drag is currently in progress. */
  isPanning: boolean
  /**
   * The left panel's committed inline-style width in px, or `null` to leave
   * the CSS default in place -- `editor/js/resize.ts` never wrote
   * `panelLeft.style.width` until the first resize drag either.
   */
  panelLeftWidth: number | null
  /** Whether a panel-resize drag is currently in progress. */
  isResizingPanel: boolean
  /**
   * Config-panel fields below (zombie-mermaid#808) replace
   * `editor/js/color-picker.ts`'s/`font-picker.ts`'s/`config-panel.ts`'s
   * module-level mutable state (`cfgColors`, `cfgFont`, `cfgPadding`,
   * `cfgEdgeStroke`, `cfgNodeStroke`) with real reducer state -- see
   * `editor-config.tsx`'s `ConfigPanel` for the markup and
   * `window.__editorConfigState` for the bridge `editor/js/rendering.ts`
   * (not ported until #810) reads `config`/the stroke fields through.
   */
  /** Per-key color overrides -- `''` means "no override, use the active theme's own". */
  colors: Record<ColorKey, string>
  /** Selected font-family override, or `''` for the theme/browser default. */
  font: string
  /** Diagram padding in px -- `editor/js/config-panel.ts`'s old `cfgPadding`. */
  padding: number
  /** Edge stroke-width multiplier applied post-render (not part of `config`). */
  edgeStroke: number
  /** Node/shape stroke-width multiplier applied post-render (not part of `config`). */
  nodeStroke: number
  /**
   * zombie-mermaid#809: tabs/buttons/export/toast replace
   * `editor/js/tabs.ts`'s/`buttons.ts`'s/`export.ts`'s/`toast.ts`'s own
   * module-level mutable state with reducer state, the same migration #807
   * did for zoom/pan/resize above. See
   * `editor-tabs.ts`/`editor-buttons.ts`/`editor-export.ts`/`editor-toast.ts`
   * for the effects that read/write them.
   */
  /** Which panel is showing -- `editor/js/tabs.ts`'s old `.tab.active`/`data-panel`. */
  activeTab: 'code' | 'config'
  /** `editor/js/export.ts`'s old `exportScale` module-level variable. */
  exportScale: number
  /** Whether the export dropdown (`#export-dropdown`) is open. */
  exportDropdownOpen: boolean
  /** The toast's current message -- `editor/js/toast.ts`'s old `toast.textContent`. */
  toastMessage: string
  /** Whether the toast is showing -- `editor/js/toast.ts`'s old `.show` class. */
  toastVisible: boolean
  /**
   * Incremented on every `SHOW_TOAST` dispatch, including a repeat of the
   * *same* message -- `editor-toast.ts`'s auto-dismiss effect keys its
   * timer off this (not `toastMessage`) so two identical toasts in a row
   * still each get their own full 2500ms window, matching
   * `editor/js/toast.ts`'s old unconditional `clearTimeout` + `setTimeout`
   * on every call (a `useEffect` keyed on the message text alone would not
   * re-fire for an unchanged value).
   */
  toastNonce: number
  /**
   * Whether `.editor-tool-shell` is the page's native Fullscreen API
   * element (`document.fullscreenElement`) -- see `editor-fullscreen.ts`'s
   * `useEditorFullscreen`. Always kept in sync *from* `fullscreenchange`
   * rather than set eagerly on click, so it reflects reality even when the
   * browser exits fullscreen on its own (Esc, a shell-level gesture, or a
   * `requestFullscreen()` promise rejection).
   */
  fullscreen: boolean
}

export const INITIAL_EDITOR_STATE: EditorState = {
  theme: '',
  zoom: 1,
  config: {},
  panActive: false,
  isPanning: false,
  panelLeftWidth: null,
  isResizingPanel: false,
  colors: { bg: '', fg: '', accent: '', line: '', muted: '', surface: '' },
  font: '',
  padding: DEFAULT_PADDING,
  edgeStroke: DEFAULT_STROKE,
  nodeStroke: DEFAULT_STROKE,
  activeTab: 'code',
  exportScale: 4,
  exportDropdownOpen: false,
  toastMessage: '',
  toastVisible: false,
  toastNonce: 0,
  fullscreen: false,
}

export type EditorAction =
  | { type: 'SET_THEME'; theme: string }
  | { type: 'SET_ZOOM'; zoom: number }
  /**
   * Multiplies the *current* zoom by `factor` -- unlike `SET_ZOOM`, the
   * reducer reads the previous zoom itself instead of the caller
   * precomputing it. This matters under rapid repeated dispatches (e.g.
   * several zoom-in clicks with no render in between): React guarantees
   * each queued action in a batch is applied against the *result* of the
   * one before it, so three `ZOOM_BY_FACTOR` dispatches correctly compound
   * (1 -> 1.25 -> 1.5625 -> ...). A caller-side `zoom: stateRef.current.zoom
   * * 1.25` doesn't -- `stateRef.current` only updates on a render, so
   * three such dispatches queued before any render all read the *same*
   * stale zoom and collapse to one step. Confirmed empirically while
   * building this PR (rapid synchronous clicks landed at 125%, not the
   * expected ~195%) -- see editor-viewport.ts's zoom-button handlers,
   * which use this action instead of `SET_ZOOM` for exactly this reason.
   */
  | { type: 'ZOOM_BY_FACTOR'; factor: number }
  | { type: 'SET_CONFIG'; config: Record<string, unknown> }
  | { type: 'SET_PAN_ACTIVE'; active: boolean }
  | { type: 'TOGGLE_PAN_ACTIVE' }
  | { type: 'SET_PANNING'; panning: boolean }
  | { type: 'SET_PANEL_LEFT_WIDTH'; width: number }
  | { type: 'SET_RESIZING_PANEL'; resizing: boolean }
  | { type: 'SET_COLOR'; key: ColorKey; value: string }
  | { type: 'SET_FONT'; font: string }
  | { type: 'SET_PADDING'; padding: number }
  | { type: 'SET_EDGE_STROKE'; value: number }
  | { type: 'SET_NODE_STROKE'; value: number }
  | { type: 'SET_ACTIVE_TAB'; tab: 'code' | 'config' }
  | { type: 'SET_EXPORT_SCALE'; scale: number }
  | { type: 'SET_EXPORT_DROPDOWN_OPEN'; open: boolean }
  | { type: 'SHOW_TOAST'; message: string }
  | { type: 'HIDE_TOAST' }
  | { type: 'SET_FULLSCREEN'; fullscreen: boolean }

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.theme }
    case 'SET_ZOOM':
      // Clamped here (not by each caller) so every path that can change
      // zoom -- buttons, ctrl/cmd-wheel, the fit action -- shares one
      // source of truth, mirroring editor/js/zoom.ts's old applyZoom()
      // clamp.
      return { ...state, zoom: clampZoom(action.zoom) }
    case 'ZOOM_BY_FACTOR':
      // See the action's doc comment above -- reads state.zoom itself
      // rather than trusting the caller's snapshot, so this composes
      // correctly across rapid, unrendered-between dispatches.
      return { ...state, zoom: clampZoom(state.zoom * action.factor) }
    case 'SET_CONFIG':
      return { ...state, config: action.config }
    case 'SET_PAN_ACTIVE':
      return { ...state, panActive: action.active }
    case 'TOGGLE_PAN_ACTIVE':
      return { ...state, panActive: !state.panActive }
    case 'SET_PANNING':
      return { ...state, isPanning: action.panning }
    case 'SET_PANEL_LEFT_WIDTH':
      return { ...state, panelLeftWidth: action.width }
    case 'SET_RESIZING_PANEL':
      return { ...state, isResizingPanel: action.resizing }
    case 'SET_COLOR': {
      const colors = { ...state.colors, [action.key]: action.value }
      return {
        ...state,
        colors,
        config: computeConfig(colors, state.font, state.padding),
      }
    }
    case 'SET_FONT':
      return {
        ...state,
        font: action.font,
        config: computeConfig(state.colors, action.font, state.padding),
      }
    case 'SET_PADDING': {
      const padding = clampPadding(action.padding)
      return {
        ...state,
        padding,
        config: computeConfig(state.colors, state.font, padding),
      }
    }
    case 'SET_EDGE_STROKE':
      return { ...state, edgeStroke: clampStroke(action.value) }
    case 'SET_NODE_STROKE':
      return { ...state, nodeStroke: clampStroke(action.value) }
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.tab }
    case 'SET_EXPORT_SCALE':
      return { ...state, exportScale: action.scale }
    case 'SET_EXPORT_DROPDOWN_OPEN':
      return { ...state, exportDropdownOpen: action.open }
    case 'SHOW_TOAST':
      return {
        ...state,
        toastMessage: action.message,
        toastVisible: true,
        toastNonce: state.toastNonce + 1,
      }
    case 'HIDE_TOAST':
      return { ...state, toastVisible: false }
    case 'SET_FULLSCREEN':
      return { ...state, fullscreen: action.fullscreen }
  }
}

const EditorStateContext = createContext<EditorState | null>(null)
const EditorDispatchContext = createContext<Dispatch<EditorAction> | null>(null)

/** Throws outside {@link EditorApp} -- mirrors `requireElement`'s "fail loudly, immediately" philosophy rather than returning a silently-wrong default. */
export function useEditorState(): EditorState {
  const state = useContext(EditorStateContext)
  if (!state) {
    throw new Error('useEditorState: no EditorApp ancestor found')
  }
  return state
}

/** Throws outside {@link EditorApp} -- see {@link useEditorState}. */
export function useEditorDispatch(): Dispatch<EditorAction> {
  const dispatch = useContext(EditorDispatchContext)
  if (!dispatch) {
    throw new Error('useEditorDispatch: no EditorApp ancestor found')
  }
  return dispatch
}

/* -----------------------------------------------------------------
 * DOM-ref core -- replaces editor/js/elements.ts's module-level lookups
 * ----------------------------------------------------------------- */

/**
 * Every element `editor/js/elements.ts` currently caches at module-eval
 * time, collected here instead once {@link EditorApp} has mounted. Field
 * names and target types match that file's exports 1:1 so a future
 * migration of a legacy module is a mechanical rename, not a redesign.
 */
export interface EditorRefs {
  editor: HTMLTextAreaElement
  lineNumbers: HTMLElement
  previewInner: HTMLElement
  previewBody: HTMLElement
  statusText: HTMLElement
  statusDot: HTMLElement
  cursorPos: HTMLElement
  renderTime: HTMLElement
  zoomLabel: HTMLElement
  spinner: HTMLElement
  toast: HTMLElement
  themeMenu: HTMLElement
  panelLeft: HTMLElement
  resizeHandle: HTMLElement
  editorView: HTMLElement
  configView: HTMLElement
  /** Added by zombie-mermaid#807 -- see `editor-viewport.ts`'s `useEditorViewport`. */
  zoomInBtn: HTMLElement
  zoomOutBtn: HTMLElement
  zoomFitBtn: HTMLElement
  panBtn: HTMLElement
  /**
   * Added by zombie-mermaid#809 -- see `editor-tabs.ts`'s `useEditorTabs`,
   * `editor-buttons.ts`'s `useEditorButtons`, and `editor-export.ts`'s
   * `useEditorExport`.
   */
  sourceToolbar: HTMLElement
  copySourceBtn: HTMLElement
  clearBtn: HTMLElement
  exportWrap: HTMLElement
  exportChevronBtn: HTMLElement
  exportMainBtn: HTMLElement
  exportDropdown: HTMLElement
  sizePills: HTMLElement
  exportPngBtn: HTMLElement
  exportSvgBtn: HTMLElement
  copyImageBtn: HTMLElement
  copyLinkBtn: HTMLElement
  /**
   * Added by zombie-mermaid#810 -- see `editor-theme.ts`'s `useEditorTheme`.
   * `editor/js/theme-button.ts`'s old direct `requireElement` calls for
   * these same three ids, plus `themeMenu` above (already part of
   * {@link EditorRefs} since #806).
   */
  themeBtnLabel: HTMLElement
  themeBtnSwatch: HTMLElement
  themeDropdownBtn: HTMLElement
  themeDropdownWrap: HTMLElement
  /** See `editor-fullscreen.ts`'s `useEditorFullscreen`. */
  fullscreenBtn: HTMLElement
  iconFullscreenEnter: SVGElement
  iconFullscreenExit: SVGElement
}

/**
 * A small, local re-implementation of `editor/js/dom.ts`'s
 * `requireElement` -- not imported from there. `editor/js/` is its own
 * `tsc` program (`editor/tsconfig.json`, no DOM-augmenting ambient globals
 * shared with `demo/`'s) and its own separately-bundled entry point
 * (`bundleForBrowser` with `treeshake: false`, run for side effects, not
 * imports); reaching into it from a `demo/components/*.tsx` file bundled
 * the normal (tree-shaken) way would couple two programs that are
 * deliberately independent for reasons documented in
 * `editor/js/global.d.ts`'s header comment. The duplication is four lines.
 */
function requireEditorElement<T extends Element>(
  id: string,
  ctor: new (...args: never[]) => T,
): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`editor: missing #${id} element`)
  if (!(el instanceof ctor)) {
    throw new Error(
      `editor: #${id} is a ${el.constructor.name}, expected ${ctor.name}`,
    )
  }
  return el
}

/**
 * Exported (unlike {@link requireEditorElement}) so
 * `__tests__/dom/editor-hydration.test.ts` can call it directly against a
 * mounted document and assert it resolves the right elements, without
 * needing a way to peek inside {@link EditorApp}'s own closed-over
 * `useLayoutEffect` — the same "small pure/DOM-query function, exported
 * for direct testing" pattern `editor/js/rendering.ts`'s `hexToRgb`/
 * `editor/js/helpers.ts`'s `escHtml` already use.
 */
export function collectEditorRefs(): EditorRefs {
  return {
    editor: requireEditorElement('code-editor', HTMLTextAreaElement),
    lineNumbers: requireEditorElement('line-numbers', HTMLElement),
    previewInner: requireEditorElement('preview-inner', HTMLElement),
    previewBody: requireEditorElement('preview-body', HTMLElement),
    statusText: requireEditorElement('status-text', HTMLElement),
    statusDot: requireEditorElement('status-dot', HTMLElement),
    cursorPos: requireEditorElement('cursor-pos', HTMLElement),
    renderTime: requireEditorElement('render-time', HTMLElement),
    zoomLabel: requireEditorElement('zoom-label', HTMLElement),
    spinner: requireEditorElement('render-spinner', HTMLElement),
    toast: requireEditorElement('toast', HTMLElement),
    themeMenu: requireEditorElement('theme-dropdown-menu', HTMLElement),
    panelLeft: requireEditorElement('panel-left', HTMLElement),
    resizeHandle: requireEditorElement('resize-handle', HTMLElement),
    editorView: requireEditorElement('editor-view', HTMLElement),
    configView: requireEditorElement('config-view', HTMLElement),
    zoomInBtn: requireEditorElement('zoom-in-btn', HTMLElement),
    zoomOutBtn: requireEditorElement('zoom-out-btn', HTMLElement),
    zoomFitBtn: requireEditorElement('zoom-fit-btn', HTMLElement),
    panBtn: requireEditorElement('pan-btn', HTMLElement),
    sourceToolbar: requireEditorElement('source-toolbar', HTMLElement),
    copySourceBtn: requireEditorElement('copy-source-btn', HTMLElement),
    clearBtn: requireEditorElement('clear-btn', HTMLElement),
    exportWrap: requireEditorElement('export-wrap', HTMLElement),
    exportChevronBtn: requireEditorElement('export-chevron-btn', HTMLElement),
    exportMainBtn: requireEditorElement('export-main-btn', HTMLElement),
    exportDropdown: requireEditorElement('export-dropdown', HTMLElement),
    sizePills: requireEditorElement('size-pills', HTMLElement),
    exportPngBtn: requireEditorElement('export-png-btn', HTMLElement),
    exportSvgBtn: requireEditorElement('export-svg-btn', HTMLElement),
    copyImageBtn: requireEditorElement('copy-image-btn', HTMLElement),
    copyLinkBtn: requireEditorElement('copy-link-btn', HTMLElement),
    themeBtnLabel: requireEditorElement('theme-btn-label', HTMLElement),
    themeBtnSwatch: requireEditorElement('theme-btn-swatch', HTMLElement),
    themeDropdownBtn: requireEditorElement('theme-dropdown-btn', HTMLElement),
    themeDropdownWrap: requireEditorElement('theme-dropdown-wrap', HTMLElement),
    fullscreenBtn: requireEditorElement('fullscreen-btn', HTMLElement),
    iconFullscreenEnter: requireEditorElement(
      'icon-fullscreen-enter',
      SVGElement,
    ),
    iconFullscreenExit: requireEditorElement(
      'icon-fullscreen-exit',
      SVGElement,
    ),
  }
}

const EditorRefsContext = createContext<{
  current: EditorRefs | null
} | null>(null)

/**
 * Returns the mutable ref object holding every {@link EditorRefs} element,
 * collected by {@link EditorApp} in a `useLayoutEffect` immediately after
 * mount. `.current` is `null` until that effect has run -- see this file's
 * header comment for the exact ordering guarantee. Throws outside
 * {@link EditorApp} entirely (no ancestor at all), the same "fail loudly"
 * philosophy as {@link useEditorState}; a `.current` still being `null`
 * despite a real ancestor is a *timing* bug in the caller, not a missing
 * ancestor, so that case is left to the caller to guard (e.g. inside an
 * event handler, which only ever runs after mount, `.current` is always
 * populated).
 */
export function useEditorRefs(): { current: EditorRefs | null } {
  const refs = useContext(EditorRefsContext)
  if (!refs) {
    throw new Error('useEditorRefs: no EditorApp ancestor found')
  }
  return refs
}

/* -----------------------------------------------------------------
 * The hydrated tree itself
 * ----------------------------------------------------------------- */

export interface EditorAppProps {
  themes: readonly EditorThemeItem[]
}

/**
 * Everything inside {@link EDITOR_ROOT_ID}'s hydration boundary: the
 * topbar, the two panels, and the toast -- the same tree the old
 * `EditorChrome` rendered (see this file's header comment). The exact same
 * function runs on both sides of hydration:
 * `demo/components/editor-app-island.tsx`'s `EditorAppIsland` renders it
 * server-side via `renderToString`, and `demo/editor-client.tsx` passes it
 * straight to `hydrateRoot()` client-side, targeting the same container.
 */
export function EditorApp({ themes }: EditorAppProps) {
  const [state, dispatch] = useReducer(editorReducer, INITIAL_EDITOR_STATE)
  const refs = useRef<EditorRefs | null>(null)

  useLayoutEffect(() => {
    refs.current = collectEditorRefs()
    // Signals demo/editor-client.tsx's runLegacyEditorBundle() that it's
    // now safe to run the legacy editor/js/*.ts bundle -- see
    // EDITOR_HYDRATED_EVENT's doc comment for why this has to be a real
    // event, not just "comes after in the script tag order."
    window.dispatchEvent(new Event(EDITOR_HYDRATED_EVENT))
  }, [])

  // zombie-mermaid#807: zoom/pan/panel-resize's own effects, registered
  // *after* the layout effect above so refs.current is already populated
  // by the time any of them runs -- see editor-viewport.ts's header
  // comment for why call order (not `useEffect` vs `useLayoutEffect`
  // alone) is what guarantees this.
  useEditorViewport({ state, dispatch, refs })

  // zombie-mermaid#808: registers window.__editorConfigState for
  // editor/js/rendering.ts to call, and re-applies edge/node stroke
  // overrides to the currently-rendered SVG -- see editor-config.tsx's
  // header comment. Reads refs.current (not just registers a callback that
  // reads it later), so -- like useEditorViewport -- this must run after
  // the layout effect above has populated it.
  useEditorConfig({ state, refs })

  // zombie-mermaid#809: tabs/buttons/export/toast -- see each hook's own
  // file for what it replaces. Order among these four doesn't matter the
  // way it did for the ref-collecting effect above (none of them depend on
  // another's DOM writes), but all run after it for the same reason
  // useEditorViewport does -- see this file's header comment.
  useEditorTabs({ state, dispatch, refs })
  useEditorButtons({ dispatch, refs })
  useEditorExport({ state, dispatch, refs })
  useEditorToast({ state, dispatch })

  // The fullscreen toggle -- has no ordering dependency on any hook above or
  // below (it neither reads nor writes anything they own), so its position
  // in this list is arbitrary. See editor-fullscreen.ts.
  useEditorFullscreen({ state, dispatch, refs })

  // zombie-mermaid#810: the render pipeline and URL-hash sharing. See
  // editor-rendering.ts's/editor-sharing.ts's header comments for what
  // these register.
  useEditorRendering({ state, refs })
  useEditorSharing({ state, refs })

  // zombie-mermaid#810: the theme dropdown and the client bootstrap, called
  // last -- its bootstrap effect needs window.__editorRenderTrigger (from
  // useEditorRendering just above) already in place. See editor-theme.ts's
  // header comment for the full ordering rationale.
  useEditorTheme({ state, dispatch, refs, themes })

  return (
    <EditorStateContext.Provider value={state}>
      <EditorDispatchContext.Provider value={dispatch}>
        <EditorRefsContext.Provider value={refs}>
          <EditorChromeMarkup
            themes={themes}
            state={state}
            dispatch={dispatch}
            toastMessage={state.toastMessage}
            toastVisible={state.toastVisible}
          />
        </EditorRefsContext.Provider>
      </EditorDispatchContext.Provider>
    </EditorStateContext.Provider>
  )
}

/**
 * The plain markup itself, split out only so {@link EditorApp} can wrap it
 * in the providers above without an extra DOM node between them (a
 * `Provider` renders no element of its own, but nesting the markup as a
 * named component keeps the tree above readable). No wrapper `<div>` is
 * introduced anywhere in this subtree -- `.topbar` and `.main` stay direct
 * children of whatever mounts {@link EditorApp}, matching every comment in
 * `editor-page.tsx`/`editor-topbar.tsx`/`editor-panels.tsx` warning that an
 * extra wrapper here breaks the engine's own flex layout.
 *
 * `state`/`dispatch` are threaded through as plain props (not read via
 * `EditorLeftPanel` calling `useEditorState()`/`useEditorDispatch()`
 * itself) so `editor-panels.tsx` never needs a runtime import from this
 * file -- see `EditorLeftPanelProps`'s doc comment in that file for why
 * that would be a real circular import (this file already imports
 * `EditorLeftPanel`/`EditorRightPanel` from there).
 */
function EditorChromeMarkup({
  themes,
  state,
  dispatch,
  toastMessage,
  toastVisible,
}: {
  themes: readonly EditorThemeItem[]
  state: EditorState
  dispatch: Dispatch<EditorAction>
  /**
   * zombie-mermaid#809: the toast's own content and `.show` class are now
   * plain React output instead of `editor/js/toast.ts`'s imperative
   * `textContent`/`classList` writes -- see `editor-toast.ts`'s
   * `useEditorToast` for the auto-dismiss timer. `id="toast"` is kept
   * (nothing dynamic depends on it staying an id, but existing tests and
   * this file's own `EditorRefs.toast` still look it up by id).
   */
  toastMessage: string
  toastVisible: boolean
}): ReactNode {
  return (
    <>
      <EditorTopbar themeItems={<EditorThemeItems themes={themes} />} />

      <div className="main">
        <EditorLeftPanel state={state} dispatch={dispatch} />
        <div className="resize-handle" id="resize-handle" />
        <EditorRightPanel />
      </div>

      <div className={toastVisible ? 'toast show' : 'toast'} id="toast">
        {toastMessage}
      </div>
    </>
  )
}
