# Editor `EditorState`/`EditorAction`/`editorReducer` slice split: not adopted

## Context

An architecture review (following the dedup pattern in
[#1076](https://github.com/dfadler/zombie-mermaid/pull/1076)) flagged
`demo/components/editor-app.tsx`'s single flat `EditorState` (~15 fields),
`EditorAction` (~20 variants), and `editorReducer` as a shallow-interface
candidate: seven feature hooks (`editor-viewport.ts`, `editor-config.tsx`,
`editor-export.ts`, `editor-output-mode.ts`, `editor-tabs.ts`,
`editor-toast.ts`, `editor-fullscreen.ts`) each declare a dependency on the
_entire_ editor state and action space, though each only reads/writes 2-5
fields and dispatches 1-3 action variants. The proposed deepening: split
into per-concern state/action/reducer slices (viewport, config, tabs,
export/toast, fullscreen, output-mode) composed in `EditorApp`, so each
hook's declared interface shrinks to just its own slice.

This was flagged speculative from the start: `editor-app.tsx`'s own header
comment documents a deliberate, staged migration (issues #806-#810, #976)
onto one shared reducer, and `ZOOM_BY_FACTOR`'s doc comment says same-tick
dispatch ordering depends on it. A follow-up investigation (worktree
`agent-a55310514a43ad248`, not preserved — findings recorded here instead)
read `editor-app.tsx` in full, the seven target hooks, the three other
hooks `EditorApp` composes (`editor-rendering.ts`, `editor-sharing.ts`,
`editor-theme.ts`, `editor-buttons.ts`), `editor-panels.tsx`, and
`__tests__/dom/editor-hydration.test.ts`, and grepped every `EditorState`
field for external references across `demo/components/*.ts(x)`.

## Decision

**Do not split `editorReducer` into per-concern slices.** Keep one shared
reducer behind `EditorStateContext`/`EditorDispatchContext`.

The two risks the original candidate flagged turned out not to be
blockers:

- `zoom`/`panActive`/`isPanning`/`panelLeftWidth`/`isResizingPanel` (the
  `ZOOM_BY_FACTOR` compounding concern) are read/written exclusively inside
  `editor-viewport.ts` — the same-tick guarantee only needs one
  `useReducer`'s own sequential-application behavior, which a `viewport`
  slice would preserve on its own.
- `colors`/`font`/`padding` (the `SET_COLOR`/`SET_FONT`/`SET_PADDING`
  shared-`config`-recompute concern) are similarly self-contained within a
  `config` slice.

What actually blocks the split is three things the candidate didn't
anticipate:

1. **`useEditorExport` reads across the proposed slice boundary.**
   `editor-export.ts` reads `stateRef.current.outputMode` (a different
   proposed slice) in three places to decide which preview element to
   export. Its interface can't shrink to "just export" without either an
   explicit cross-slice parameter or still taking the composed state.
2. **`theme` has no owning slice, and three out-of-scope hooks need it
   alongside other slices' fields.** `editor-rendering.ts` reads
   `state.theme`, `state.config`, and `state.outputMode` together in one
   hook; `editor-sharing.ts`/`editor-theme.ts` also read `state.theme`,
   with `useEditorTheme` depending on `useEditorRendering` registering
   `window.__editorRenderTrigger` first. These are legitimate existing
   consumers that need a merged, cross-slice view — exactly what the
   shared reducer gives them for free today.
3. **Toast has a third writer outside the proposed scope.** `SHOW_TOAST` is
   dispatched from `editor-export.ts` (in scope) and `editor-buttons.ts`
   (not one of the seven target hooks) — the candidate's "export/toast"
   grouping only accounted for one of the two.

Beyond field coupling, the exported `useEditorState()`/`useEditorDispatch()`
context contract is one flat state object and one dispatch accepting any of
20 action variants. Preserving that under N independent `useReducer`s needs
a dispatch router duplicating `editorReducer`'s switch in a second file with
no compiler link between them: today, a missing `case` for a new
`EditorAction` variant is a compile error (the switch has no `default`);
with a router, it's a silent runtime no-op. Given this reducer has already
grown across five separate efforts (#807 → #808 → #809 → #810 → #976),
that's a standing maintenance cost, not a one-time one.

A narrower split — pulling out only `viewport` and `fullscreen` (the two
field groups with zero external references and a single writer) — is
technically safe, but was also not adopted: it still requires touching
`editor-app.tsx`'s exported types and the context composition, and keeping
`__tests__/dom/editor-hydration.test.ts`'s flat-reducer assertions green,
for a payoff of only 2 of the 7 target hooks getting a smaller interface.

## Consequences

- The architecture review's four candidates are fully resolved: three
  shipped ([#1079](https://github.com/dfadler/zombie-mermaid/pull/1079),
  [#1081](https://github.com/dfadler/zombie-mermaid/pull/1081),
  [#1082](https://github.com/dfadler/zombie-mermaid/pull/1082)), this one
  is declined.
- A future re-proposal of splitting this reducer should start from the
  three blockers above, not re-derive them. It should also address the two
  things that would make a split materially more tractable: migrating
  `editor-rendering.ts`/`editor-sharing.ts`/`editor-theme.ts` onto explicit
  per-field reads instead of a broad `state: EditorState` parameter first
  (shrinking the cross-slice-consumer surface), and deciding whether
  `useEditorState()`/`useEditorDispatch()` are worth keeping at all — no
  call site currently uses them successfully, so dropping them would remove
  the hardest part of the dispatch-routing problem for free.
- This does not block adding a _new_, clearly independent slice in the
  future (e.g. a feature with no cross-slice reads) — it only rules out
  retrofitting the existing seven-hook, six-concern state as it stands
  today.
