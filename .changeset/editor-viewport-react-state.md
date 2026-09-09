---
---

No release: moves the live editor's zoom, pan, and panel-resize behavior
onto React state (`demo/components/editor-app.tsx`'s reducer, extended;
`demo/components/editor-viewport.ts`'s new `useEditorViewport` hook),
replacing `editor/js/zoom.ts`, `pan.ts`, and `resize.ts` (deleted) and their
module-level mutable variables — the second of five editor sub-issues
(#806-#810) in the #797 hydration epic, building on #806's hydration shell.
`editor/js/rendering.ts` (not ported to React until #810) still needs to
reapply the current zoom level after every render; it now does that through
a `window.__editorViewportState` bridge, following this repo's existing
`window.__mermaid`/`window.__themeState` bridge convention for legacy
scripts that need to reach React-owned state.

Two real bugs surfaced only by live-browser (CDP) interaction testing, not
by RTL/jsdom tests (which flush state synchronously via `act()` and can't
reproduce this timing): rapid resize-handle dragging and rapid zoom-in
clicks each raced against React's asynchronous re-render when a plain
native (non-React) event listener gated on `stateRef.current` instead of a
value guaranteed fresh at read time. Fixed by having panel-resize track its
in-progress state in a synchronous local closure variable (mirroring pan's
existing `panStart` pattern) rather than reading back through React state,
and by adding a `ZOOM_BY_FACTOR` reducer action that reads `state.zoom`
itself — so repeated dispatches compound correctly under React's batching —
instead of each caller precomputing the next value from a snapshot that may
not have re-rendered yet.

No behavior change otherwise: zoom increments/clamping, pan drag mechanics,
and resize drag mechanics/constraints are pixel/interaction-identical to
before — verified with matching before/after screenshots, live interaction
in a real browser (zoom, pan, and resize actually exercised via CDP and the
embedded browser tool, clean console, no hydration warnings), sabotage-
checked new RTL interaction tests under `__tests__/dom/editor-viewport.test.ts`
(replacing `editor/__tests__/zoom.test.ts`), and `editor/__tests__/*`'s
remaining suite (unchanged, still passing). Closes #807. Nothing here
touches the published `zombie-mermaid` package.
