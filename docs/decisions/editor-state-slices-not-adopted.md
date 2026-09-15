# Editor `EditorState`/`EditorAction`/`editorReducer` slice split: not adopted

## Context

An architecture review (following the dedup pattern in
[#1076](https://github.com/dfadler/zombie-mermaid/pull/1076)) flagged
`demo/components/editor-app.tsx`'s single flat `EditorState`/`EditorAction`/
`editorReducer` as a shallow-interface candidate: seven feature hooks each
declare a dependency on the entire editor state and action space, though
each only touches a handful of fields. The proposed deepening: split into
per-concern state/action/reducer slices (viewport, config, tabs,
export/toast, fullscreen, output-mode).

This was flagged speculative from the start — `editor-app.tsx`'s own header
comment documents a deliberate, staged migration (#806, #807, #808, #809,
#810, #976) onto one shared reducer. Full investigation notes (which fields
are coupled, why, and what a narrower split would look like) are in
[#1085](https://github.com/dfadler/zombie-mermaid/issues/1085).

## Decision

**Do not split `editorReducer` into per-concern slices.** Keep one shared
reducer behind `EditorStateContext`/`EditorDispatchContext`.

The two risks the header comment originally flagged (zoom-compounding
ordering, shared `config` recompute) turned out to be fine in isolation.
What actually blocks the split is three things the candidate didn't
anticipate — `useEditorExport` reads a field from a different proposed
slice, `theme` has no owning slice and multiple out-of-scope hooks need it
cross-slice, and toast has a third dispatch site outside the proposed
scope — plus a structural cost: preserving the exported
`useEditorState()`/`useEditorDispatch()` contract would need a dispatch
router duplicating `editorReducer`'s switch with no compiler link between
them, trading today's compile-time safety net (a missing `case` fails to
build) for a silent-runtime-no-op risk. See #1085 for the full
field-by-field breakdown, including why a narrower split (just `viewport`
and `fullscreen`) was also judged not worth it.

## Consequences

- The architecture review's four candidates are fully resolved: three
  shipped ([#1079](https://github.com/dfadler/zombie-mermaid/pull/1079),
  [#1081](https://github.com/dfadler/zombie-mermaid/pull/1081),
  [#1082](https://github.com/dfadler/zombie-mermaid/pull/1082)), this one
  is declined.
- A future re-proposal of splitting this reducer should start from
  [#1085](https://github.com/dfadler/zombie-mermaid/issues/1085)'s
  blockers, not re-derive them.
- This does not block adding a _new_, clearly independent slice in the
  future (e.g. a feature with no cross-slice reads) — it only rules out
  retrofitting the existing seven-hook, six-concern state as it stands
  today.
