---
---

No release: fixes the live editor's card (`.editor-tool-shell`) showing the
surrounding marketing page's dark background through its topbar in normal
(non-fullscreen) view -- `.topbar` itself is `background: transparent`, and
the card never painted an opaque background of its own outside of native
fullscreen (whose own CSS rule happened to set one). The card now sets
`background: var(--t-bg)` in both states. Also removes the editor's
dark/light chrome toggle (button, reducer state, `useEditorDarkMode`, and
the dark-mode-derived auto diagram theme), since the chrome no longer needs
a second color mode. Nothing here touches the published `zombie-mermaid`
package.
