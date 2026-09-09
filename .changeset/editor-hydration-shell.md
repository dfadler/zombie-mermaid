---
---

No release: gives the live editor a real `hydrateRoot()` shell
(zombie-mermaid#806), the enabling issue for the editor rewrite
(#807-810 build on it). `demo/components/editor-page.tsx`'s `EditorChrome`
(topbar, panels, toast) moves to the new `demo/components/editor-app.tsx`'s
`EditorApp`, hydrated by the new `demo/editor-client.tsx` — the same
SSR-then-hydrate pattern every other #797 page uses.

**Deliberately scoped small**, per this issue's own acceptance criteria:
`editor.ts`'s inlined `scriptJs` — the bundled renderer plus all 18
`editor/js/*.ts` modules (state, elements, zoom, pan, tabs, color/font
pickers, export, rendering, sharing, ...) — is completely untouched.
Those modules keep running exactly as they do today: plain, eagerly
evaluated TS modules that find their DOM via `elements.ts`'s
`getElementById()` calls and mutate a shared, module-level `state` object
directly. New `demo/editor-state.ts` documents the `useReducer`/typed-
`useRef` shape #807-810 will incrementally migrate those two modules onto
— not wired into `EditorApp` yet, since #806's own scope note says "land
the other four editor modules as no-op stubs or leave them un-ported
temporarily" and there is no real consumer for it yet.

**A real hydration-mismatch bug, found and fixed during development, not
by reasoning alone.** Loading the actual built `editor.html` in a browser
threw React error #418 (hydration mismatch) — `editor/js/init.ts`'s
own top-level code renders the default diagram (`scheduleRender(0)`) and
updates the line-number gutter synchronously on page load, both of which
directly overwrite DOM nodes (`#preview-inner`, `#line-numbers`) that sit
inside `EditorApp`'s hydrated tree, before React's own hydration-match
verification (itself asynchronous, not fully synchronous despite
`hydrateRoot()` returning immediately) had settled. Fixed two ways,
together:

1. `editor-page.tsx` now places the new hydration script's `<script
type="module">` tag _before_ `scriptJs`'s tag (both execute in
   document order), and `demo/editor-client.tsx` wraps its `hydrateRoot()`
   call in `react-dom`'s `flushSync()` to force the initial commit fully
   synchronous.
2. `demo/components/editor-panels.tsx`'s `#line-numbers` and
   `#preview-inner` now render via `dangerouslySetInnerHTML` (their exact
   existing literal/placeholder content, byte-identical) instead of plain
   JSX children — the same "opaque hydration leaf" technique
   `ThemePickerIsland` and every other page's externally-mutated content
   already uses throughout this epic, applied here to the two specific
   nodes `editor/js`'s own startup sequence is confirmed to mutate.

Confirmed via a real headless-browser load of the built `editor.html`
(not just the jsdom test suite, which did not reproduce this — the
mismatch only manifested against the real, full editor/js bundle) that
the error is gone, typing in the source panel and switching themes both
still work with zero console errors.

Verified: full test suite green (including a new `__tests__/dom/editor-
hydration.test.ts` covering clean hydration and the topbar/panels/toast
structure, sabotage-checked), `editor/__tests__/*.test.ts` (sharing, zoom,
export, rendering, config — 462 lines across 5 files) unaffected and still
passing unchanged, `editor/__tests__/support/harness.ts` updated to import
from the new canonical `editor-app.tsx` and mount `EditorApp` directly,
golden-DOM fixture regenerated for the script-tag reorder. Measured cost:
the new `editor-client.tsx` bundle is ~199 KB raw / ~61 KB gzip, in line
with the #797 epic's ~57.5 KB gzip react/react-dom floor; confirmed via
Rollup's own `moduleIds` that it resolves zero `react-dom/server` modules.

Nothing here touches the published `zombie-mermaid` package.
