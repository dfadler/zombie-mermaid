/**
 * The documented target shape for #807-810's incremental migration of
 * `editor/js/state.ts`'s `state` object and `editor/js/elements.ts`'s
 * cached DOM references onto real React state/refs (zombie-mermaid#806).
 *
 * **Not wired into `EditorApp` yet.** #806's own acceptance criteria only
 * asks for this shape to be documented well enough for the four remaining
 * editor sub-issues to build on without re-deriving the design — not for
 * every one of `editor/js/*.ts`'s 14 non-foundational modules (zoom, pan,
 * tabs, color/font pickers, export, rendering, sharing, dark mode, ...) to
 * be migrated onto it in this one PR. Wiring an `EditorStateProvider` with
 * no real consumer into the hydrated tree today would add indirection
 * with no payoff; `demo/components/editor-app.tsx`'s own header comment
 * explains why leaving `editor/js/*.ts` untouched for now is safe (those
 * modules only need the DOM to exist with the right ids by the time they
 * run — hydrated or merely server-rendered markup satisfies that equally
 * well).
 *
 * **How this maps onto what exists today:**
 *
 * - `editor/js/state.ts`'s `EditorState` (`{ theme, zoom, config }`, a
 *   plain mutable module-level object every consumer imports and mutates
 *   directly) becomes {@link EditorState} here, driven by {@link
 *   editorReducer} through `useReducer` instead of direct field
 *   assignment. Each of `state.ts`'s three fields gets one {@link
 *   EditorAction} variant; a module migrating onto this dispatches an
 *   action instead of writing `state.theme = x` directly, the same shift
 *   `theme-state.ts`'s `setTheme()` already made site-wide for the rest of
 *   this demo (see that module's own header comment) — this is that same
 *   pattern, scoped to the editor's own local state instead of the
 *   cross-page shared theme.
 * - `editor/js/elements.ts`'s sixteen `requireElement(id, Type)` calls
 *   (cached once, at module-import time, via `getElementById`) become
 *   sixteen `useRef<T>(null)` refs on {@link EditorRefs}, attached to their
 *   JSX elements in `editor-app.tsx`'s component tree the normal React
 *   way (`ref={refs.editor}`) instead of being looked up after the fact.
 *   A ref that hasn't attached yet reads `null`, unlike today's
 *   `requireElement()` (which throws immediately if the id is missing) —
 *   any module migrating onto this needs to account for that (either by
 *   only reading refs from inside an effect/event handler, which always
 *   runs after the initial commit attaches them, or by asserting
 *   non-null at the specific call site with a clear error, mirroring
 *   `requireElement()`'s own contract).
 * - `editor/js/editor-helpers.ts`/`editor/js/helpers.ts` (line-number/
 *   cursor-position display, HTML/attribute escaping) are pure functions
 *   of a value or a cached element and need no state/ref migration at all
 *   — `helpers.ts` in particular has zero DOM/state dependency and can be
 *   imported unchanged from anywhere, hooks-based or not.
 *
 * **Why a reducer, not several `useState` calls:** `zoom`/`theme`/`config`
 * already change together in places today (e.g. loading a shared URL hash
 * — see `editor/js/sharing.ts` — sets source, theme, *and* implicitly
 * resets zoom in one logical operation); a reducer gives #807-810 one
 * place to keep those transitions atomic instead of three separate
 * `useState` setters that could observe each other's stale closures
 * across renders.
 */
import {
  createContext,
  createElement,
  useContext,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
  type RefObject,
} from 'react'

/**
 * Mirrors `editor/js/state.ts`'s `EditorState` exactly — same three
 * fields, same types. Kept as a distinct type (not imported from
 * `editor/js/state.ts`) since that module is part of the separately
 * bundled, unported `editor/js/*.ts` graph (see `editor-app.tsx`'s header
 * comment) and this file must never import from it — this file is itself
 * part of `EditorApp`'s own hydrated bundle once a future sub-issue wires
 * it in, and `editor/js/state.ts` reads `window.__mermaid` at module-
 * evaluation time (see that file's own header comment), a global only
 * `src/browser.ts`'s bundle guarantees exists — pulling that import chain
 * into this file's bundle would be exactly the kind of unwanted coupling
 * `dashboard-app.tsx`'s header comment warns every hydrated-app file
 * about, just for a different concrete dependency than `react-dom/server`.
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
  | { type: 'setTheme'; theme: string }
  | { type: 'setZoom'; zoom: number }
  | { type: 'setConfig'; config: Record<string, unknown> }

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case 'setTheme':
      return { ...state, theme: action.theme }
    case 'setZoom':
      return { ...state, zoom: action.zoom }
    case 'setConfig':
      return { ...state, config: action.config }
  }
}

export interface EditorStateContextValue {
  state: EditorState
  dispatch: Dispatch<EditorAction>
}

const EditorStateContext = createContext<EditorStateContextValue | undefined>(
  undefined,
)

/**
 * Wraps `children` with the editor's `useReducer`-backed state, once a
 * future sub-issue mounts this inside `EditorApp`'s tree. Not mounted
 * anywhere yet — see this file's header comment for why #806 documents
 * this shape without wiring it in.
 */
export function EditorStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(editorReducer, INITIAL_EDITOR_STATE)
  return createElement(
    EditorStateContext.Provider,
    { value: { state, dispatch } },
    children,
  )
}

/**
 * Reads the editor's state + dispatch from context. Throws outside an
 * {@link EditorStateProvider} — the same "fail loudly rather than
 * silently read a wrong default" contract `editor/js/elements.ts`'s
 * `requireElement()` already has for a missing DOM node, applied here to
 * a missing provider instead.
 */
export function useEditorState(): EditorStateContextValue {
  const value = useContext(EditorStateContext)
  if (!value) {
    throw new Error('useEditorState() called outside an EditorStateProvider')
  }
  return value
}

/**
 * The typed-ref equivalent of `editor/js/elements.ts`'s sixteen cached
 * elements — same names, same concrete DOM types (`requireElement(id,
 * Type)`'s second argument), but as `RefObject<T | null>` instead of an
 * already-resolved `T`. A future sub-issue attaches each one to its JSX
 * element in `editor-app.tsx` (`ref={refs.editor}` on the `<textarea
 * id="code-editor">` `editor-panels.tsx` already renders, and so on for
 * the rest) instead of relying on `elements.ts`'s post-hoc
 * `getElementById()` lookup.
 */
export interface EditorRefs {
  editor: RefObject<HTMLTextAreaElement | null>
  lineNumbers: RefObject<HTMLElement | null>
  previewInner: RefObject<HTMLElement | null>
  previewBody: RefObject<HTMLElement | null>
  statusText: RefObject<HTMLElement | null>
  statusDot: RefObject<HTMLElement | null>
  cursorPos: RefObject<HTMLElement | null>
  renderTime: RefObject<HTMLElement | null>
  zoomLabel: RefObject<HTMLElement | null>
  spinner: RefObject<HTMLElement | null>
  toast: RefObject<HTMLElement | null>
  themeMenu: RefObject<HTMLElement | null>
  panelLeft: RefObject<HTMLElement | null>
  resizeHandle: RefObject<HTMLElement | null>
  editorView: RefObject<HTMLElement | null>
  configView: RefObject<HTMLElement | null>
}

/**
 * Creates one fresh {@link EditorRefs} bundle. A plain factory (called
 * once, e.g. `const refs = useEditorRefs()` inside `EditorApp` once a
 * future sub-issue wires this in) rather than sixteen separate exported
 * `useRef()` calls, so every consumer shares the *same* ref objects
 * instead of each `useRef(null)` call site creating its own — refs, unlike
 * context values, aren't implicitly shared just by importing the same
 * module.
 */
export function useEditorRefs(): EditorRefs {
  return {
    editor: useRef(null),
    lineNumbers: useRef(null),
    previewInner: useRef(null),
    previewBody: useRef(null),
    statusText: useRef(null),
    statusDot: useRef(null),
    cursorPos: useRef(null),
    renderTime: useRef(null),
    zoomLabel: useRef(null),
    spinner: useRef(null),
    toast: useRef(null),
    themeMenu: useRef(null),
    panelLeft: useRef(null),
    resizeHandle: useRef(null),
    editorView: useRef(null),
    configView: useRef(null),
  }
}
