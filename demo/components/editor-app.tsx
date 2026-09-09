/** @jsxRuntime automatic */
/**
 * The live editor's *hydrated* content (zombie-mermaid#806): {@link
 * EditorChrome} (the topbar, the two panels, and the toast) — the exact
 * same tree `editor/__tests__/support/harness.ts` mounts and
 * `editor/js/*.ts` queries by id, moved here (from `editor-page.tsx`) so
 * this file, and everything it imports, never touches `react-dom/server` —
 * mirroring `dashboard-app.tsx`'s split, and every other page-app split
 * this issue's four predecessors (#802-#805) already established.
 *
 * **What #806 actually changes, and what it deliberately doesn't.**
 * `editor.ts`'s inlined `scriptJs` — the bundled renderer plus every
 * `editor/js/*.ts` module (state, elements, zoom, pan, tabs, color/font
 * pickers, export, rendering, sharing, ...) — is untouched by this issue.
 * Those modules keep running exactly as they do today: plain, eagerly-
 * evaluated TS modules that find their DOM via `elements.ts`'s
 * `getElementById()` calls and mutate a shared, module-level `state`
 * object directly (`editor/js/state.ts`). That's safe to leave alone
 * because none of it depends on *how* the DOM it queries got there — only
 * that it exists with the right ids by the time those modules run, which
 * server-rendered (now hydrated) markup satisfies exactly as well as the
 * old `renderToStaticMarkup`-only markup did. `{@link EditorChrome}`'s own
 * render output is byte-for-byte unchanged by this split; only *how* it
 * reaches the browser (hydrated now, not just static) is new.
 *
 * The *reverse* direction does matter, though: `editor/js/init.ts`'s own
 * top-level code mutates some of that same DOM synchronously (e.g.
 * `updateLineNumbers()` sets `#line-numbers`'s `textContent`), and if that
 * ran before `demo/editor-client.tsx`'s `hydrateRoot()` call finished,
 * React would find already-mutated nodes mid-hydration and throw a real
 * mismatch error — caught for real during this issue's own development.
 * See that file's header comment for the fix (script tag ordering plus
 * `flushSync()`).
 *
 * `demo/editor-state.ts` (new, alongside this file) documents the
 * `useReducer`/typed-`useRef` shape #807-810 will incrementally migrate
 * `editor/js/state.ts`'s `state` object and `editor/js/elements.ts`'s
 * cached DOM refs onto, module by module — see that file's own header
 * comment. It is **not** wired into {@link EditorApp} yet: #806's own
 * acceptance criteria only asks for the shape to be documented well
 * enough to build on, not for every consumer to be migrated in this one
 * PR (see this issue's own "land the other four editor modules as no-op
 * stubs or leave them un-ported temporarily" scope note) — wiring an
 * unused Context provider into the hydrated tree here would add
 * indirection with no payoff until a real consumer exists.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { ReactNode } from 'react'
import {
  EditorTopbar,
  EditorThemeItems,
  type EditorThemeItem,
} from './editor-topbar.tsx'
import { EditorLeftPanel, EditorRightPanel } from './editor-panels.tsx'

/**
 * `editor-root`: id of the *hydration container* `demo/editor-client.tsx`'s
 * `hydrateRoot()` call mounts onto — the existing `.editor-tool-shell` div
 * `editor-page.tsx`'s `EditorPage` already wraps {@link EditorChrome} in,
 * not part of {@link EditorApp}'s own render output. See `dashboard-
 * app.tsx`'s `DASHBOARD_ROOT_ID` doc comment for why this has to be a
 * separate element from the app's own root — `.editor-tool-shell` already
 * satisfies that (it carries real layout CSS of its own, and `EditorApp`'s
 * render was never going to include it).
 */
export const EDITOR_ROOT_ID = 'editor-root'

/**
 * `editor-props`: the `<script type="application/json">` element
 * `demo/editor-client.tsx` reads {@link EditorAppProps} out of.
 */
export const EDITOR_PROPS_ELEMENT_ID = 'editor-props'

export interface EditorAppProps {
  /** The theme dropdown's entries — see `editor-topbar.tsx`'s {@link
   * EditorThemeItem}. Plain, JSON-serializable data (not the `ReactNode`
   * {@link EditorChrome} itself takes) specifically so this survives the
   * hydration props round-trip; `EditorApp` builds the actual `<EditorTopbar
   * themeItems>` element from it. */
  themes: readonly EditorThemeItem[]
}

/**
 * Everything inside {@link EDITOR_ROOT_ID}'s hydration boundary: the
 * topbar, the two panels, and the toast — the same content `editor-
 * page.tsx`'s `EditorPage` used to render via `<EditorChrome>` directly.
 * The exact same function runs on both sides of hydration.
 */
export function EditorApp({ themes }: EditorAppProps) {
  return <EditorChrome themeItems={<EditorThemeItems themes={themes} />} />
}

/**
 * Everything inside `<body>` except the inlined script: the topbar, the
 * two panels with the resize handle between them, and the toast.
 *
 * Exported so editor/__tests__/support/harness.ts can build its jsdom
 * document from the *same* component tree the generator ships, rather than
 * from a second, drifting copy of the markup (it used to read the
 * editor/html/*.html partials directly, which no longer exist).
 */
export function EditorChrome({ themeItems }: { themeItems: ReactNode }) {
  return (
    <>
      {/* Top bar */}
      <EditorTopbar themeItems={themeItems} />

      {/* Main */}
      <div className="main">
        {/* Left panel */}
        <EditorLeftPanel />

        {/* Resize handle */}
        <div className="resize-handle" id="resize-handle" />

        {/* Right panel */}
        <EditorRightPanel />
      </div>

      <div className="toast" id="toast" />
    </>
  )
}
