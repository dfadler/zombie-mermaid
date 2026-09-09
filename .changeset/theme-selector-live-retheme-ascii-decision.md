---
---

No release: closes out #689 (live re-theme of rendered diagrams + the
ASCII terminal-preview decision), part of the #684 theme-selector
restoration. No new wiring was needed — `demo/diagram-page-client.ts`
already sets every CSS custom property `themeCssVariables()` can emit on
diagram-type pages (now covered directly by new tests in
`__tests__/demo-diagram-page-client.test.ts`), and no page on the current,
#590-redesigned site renders a live ASCII terminal-preview panel to wire a
decision into. Documents both facts, plus why Fork Fixes's 27 rendered
before/after pairs are a deliberate exception to live re-theme, in
`docs/decisions/theme-selector-shared-state.md`'s "#689" amendment and a
code comment on `fork-fixes.ts`'s `renderWith()`. Also corrects
`__tests__/visual/helpers/terminal-panel.ts`'s stale header comment, which
still described a pre-#590 `demo/client.ts` gallery page and `.ascii-panel`
markup that no longer exist. Nothing here touches the published
`zombie-mermaid` package — this is demo-site UI/docs/tests only.
