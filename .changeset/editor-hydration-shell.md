---
---

No release: hydrates the live editor's own chrome (topbar, panels, toast —
`editor.html`, `editor.ts`) instead of leaving it static markup with a
separately bundled vanilla-JS layer bolted on, following the pattern
already proven for `dashboard.html`/`fork-fixes.html`/blog pages
(zombie-mermaid#797's hydration epic). This is the first of five editor
sub-issues (#806-#810); this one lands only the hydration shell and a new
state/DOM-ref core (`demo/components/editor-app.tsx`'s `EditorApp`, plus
`useEditorState`/`useEditorDispatch`/`useEditorRefs`) the later four build
on — the 18 legacy `editor/js/*.ts` modules are unchanged and keep
running exactly as before, layered on _after_ hydration completes.

Getting "after hydration completes" right took more than script ordering:
`hydrateRoot()`'s initial hydration pass is scheduled at idle priority, not
run synchronously, so several legacy modules' module-top-level DOM writes
(`config-panel.ts`'s `refreshAllColorUIs()`, `color-picker.ts`'s
preset-swatch injection, `init.ts`'s dark-mode/theme-button/line-number
writes) could still land before React's hydration pass compared against
pristine markup — confirmed with a real, reproducible "Hydration failed"
error in a real browser. Fixed by embedding the legacy bundle as inert
data instead of an executable `<script type="module">` tag, and having
`demo/editor-client.tsx` load and run it only after `<EditorApp>`
dispatches a real completion event from a `useLayoutEffect` (see that
file's and `editor-app.tsx`'s header comments for the full account).

No behavior change: editor.html's visual output and every existing
interaction (typing, theme switching, zoom, dark mode, config panel,
color/font pickers, export, URL sharing) are unchanged — verified with
matching before/after screenshots and live interaction in a real browser,
plus `editor/__tests__/*`'s existing suite (unchanged, still passing) and
new RTL hydration/interaction tests under `__tests__/dom/`. Closes #806.
Nothing here touches the published `zombie-mermaid` package.
