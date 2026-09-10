---
---

No release: scopes the Editor's diagram-theme picker back down to the
Editor itself. #688 (`docs/decisions/theme-selector-shared-state.md`)
reconciled the Editor's preview-pane theme into the shared `mermaid-theme`
state, but that had two side effects beyond its stated intent: picking any
of the 15 diagram themes also reskinned the Editor's own chrome (topbar,
both panels, the config/color/font pickers, the export dropdown) via
`document.documentElement`'s `--t-bg`/`--t-fg`/`--t-accent`, and — because
the preference lived under the same `localStorage` key every other page
syncs across tabs — a theme picked in the Editor changed every other open
tab of the site, and vice versa.

`demo/components/editor-dark-mode.ts`'s `applyChromeColorMode()` now owns
the Editor's chrome color entirely, keyed only on its independent
light/dark toggle (`bm-editor-dark`) — never on which diagram theme is
selected. `demo/components/editor-theme.ts` persists the diagram theme
under its own local `bm-editor-theme` key again (the key #688 retired), with
no shared module and no cross-tab listener. Selecting a theme in the Editor
now only changes that Editor's own rendered diagram. See
`docs/decisions/theme-selector-shared-state.md`'s new amendment for the
full rationale; every other page's shared theme state is unchanged. Nothing
here touches the published `zombie-mermaid` package — this is demo-site UI
only.
