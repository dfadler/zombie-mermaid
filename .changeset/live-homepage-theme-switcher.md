---
---

No release: makes the homepage's theme showcase a real, live, global theme
switcher, replacing the static "5 of 15" comparison grid. The showcase now
renders one real diagram (`renderMermaidSVG`, build time) plus a full
15-theme `ThemePicker`; clicking a pill re-themes the diagram and the site
chrome instantly (`demo/site-chrome-theme.ts`, #772), with no reload.
Scrolling the showcase out of view relocates the same live picker (no
clone, no duplicate ids) into the now-`position: sticky` nav's install-pill
slot — a one-way swap, per the locked-in design decision, so scrolling back
up does not restore the install pill. The separate "Pick your own theme"
section further down the homepage is removed as redundant (there is now
only one theme-preview element on the page, matching #759's decision #2).
`demo/components/nav.tsx` gains two new opt-in props (`installSlot`,
`sticky`), both defaulting to the canvas's original behavior so every other
page is unaffected. Addresses #759. Nothing here touches the published
`zombie-mermaid` package — this is demo-site UI only.
