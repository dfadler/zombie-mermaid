---
---

No release: moves the live editor's render pipeline, URL-hash sharing, the
diagram-theme dropdown, and the client-side bootstrap onto React state
(`demo/components/editor-rendering.ts`'s new `useEditorRendering`,
`demo/components/editor-sharing.ts`'s new `useEditorSharing`,
`demo/components/editor-theme.ts`'s new `useEditorTheme`), replacing
`editor/js/rendering.ts`, `sharing.ts`, `init.ts`, `dark-mode.ts`, and
`theme-button.ts` (all deleted) — the last of five editor sub-issues
(#806-#810) in the #797 hydration epic, and per that issue's own text
"likely the riskiest ... since it's the actual render loop." `editor/js/`
now contains only `elements.ts`/`editor-helpers.ts`, the code-editor
textarea's own input/keydown wiring, which has no React state to drive it.

Theme selection (`state.theme`) was deferred to this issue by #808's and
#809's own header comments, so this slice also covers the diagram-theme
dropdown, the theme button, and folding `editor/js/init.ts`'s entire
client-bootstrap sequence (dark-mode-derived default theme, the legacy
`bm-editor-theme` migration, restoring the shared saved theme, then the
URL hash) into `useEditorTheme`'s own mount effect, in the same
order-dependent sequence the original had.

The URL-hash encoding format (base64-of-JSON, `{source, theme?}`) is
unchanged byte-for-byte — a link generated before this change still loads
correctly after it, and vice versa, proven by a dedicated compatibility
test (`__tests__/dom/editor-sharing.test.ts`) that keeps a verbatim copy of
the old `encodeSource`/`decodeSource` bodies as a wire-format fixture.

No behavior change otherwise: typing/rendering, theme switching (including
the dark-mode-forces-auto-theme interaction), and URL sharing are
pixel/interaction-identical to before — verified with byte-identical
before/after screenshots, live interaction in a real browser (typing,
theme picking, and a shared link opened fresh in a new tab all exercised
directly, clean console, no hydration warnings), sabotage-checked new RTL
tests under `__tests__/dom/editor-rendering.test.ts`/`editor-sharing.test.ts`/
`editor-theme.test.ts` (replacing `editor/__tests__/rendering.test.ts`/
`sharing.test.ts`/`config.test.ts`'s theme coverage), and the full existing
suite (unchanged, still passing). Closes #810. Nothing here touches the
published `zombie-mermaid` package.
