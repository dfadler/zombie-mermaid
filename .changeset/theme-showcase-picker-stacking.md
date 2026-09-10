---
---

No release: fixes two homepage "Live theme switching" bugs in the
`ThemeShowcasePicker` dropdown. Its footnote sat at the same `z-index` as
the section's own content grid and came later in the DOM, so on an equal
tie it painted over the open dropdown regardless of the dropdown's own
(higher, but locally-scoped) `z-index` -- the grid now outranks the
footnote so its whole subtree, dropdown included, stacks above it. The
section also set its own redundant `overflow: hidden` (the ambient
background layer already clips itself to the same bounds), which cropped
the dropdown whenever it extended past the section's bottom edge; removed.

Nothing here touches the published `zombie-mermaid` package.
