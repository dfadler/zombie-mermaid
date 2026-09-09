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
 * `editor/js/state.ts` and `editor/js/elements.ts` are the shared
 * foundation all *other* 16 `editor/js/*.ts` modules (zoom, pan, resize,
 * config-panel, color-picker, font-picker, tabs, buttons, export, toast,
 * theme-button, dark-mode, rendering, sharing, init) read/write through
 * directly. Porting those two files' *exports* away in this PR would
 * require migrating every module that imports them in the same PR --
 * exactly what #806's own scope note says to avoid ("land the other four
 * editor modules as no-op stubs or leave them un-ported temporarily... the
 * goal is a working hydrated shell, not the full app in one PR"). So this
 * PR leaves `editor/js/state.ts`/`editor/js/elements.ts` and everything
 * downstream of them completely unchanged, still bundled and run exactly
 * as before (see `editor.ts`'s `bundleEditorJs()`) -- just *after* this
 * component has actually finished hydrating, instead of being the only
 * script on the page. See {@link EDITOR_HYDRATED_EVENT}'s doc comment and
 * `demo/editor-client.tsx`'s header comment for why "after hydration" has
 * to mean a real completion signal, not just script tag order.
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
import { EditorLeftPanel, EditorRightPanel } from './editor-panels.tsx'
import {
  EditorThemeItems,
  EditorTopbar,
  type EditorThemeItem,
} from './editor-topbar.tsx'

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
}

export const INITIAL_EDITOR_STATE: EditorState = {
  theme: '',
  zoom: 1,
  config: {},
}

export type EditorAction =
  | { type: 'SET_THEME'; theme: string }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_CONFIG'; config: Record<string, unknown> }

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.theme }
    case 'SET_ZOOM':
      return { ...state, zoom: action.zoom }
    case 'SET_CONFIG':
      return { ...state, config: action.config }
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

  return (
    <EditorStateContext.Provider value={state}>
      <EditorDispatchContext.Provider value={dispatch}>
        <EditorRefsContext.Provider value={refs}>
          <EditorChromeMarkup themes={themes} />
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
 */
function EditorChromeMarkup({
  themes,
}: {
  themes: readonly EditorThemeItem[]
}): ReactNode {
  return (
    <>
      <EditorTopbar themeItems={<EditorThemeItems themes={themes} />} />

      <div className="main">
        <EditorLeftPanel />
        <div className="resize-handle" id="resize-handle" />
        <EditorRightPanel />
      </div>

      <div className="toast" id="toast" />
    </>
  )
}
