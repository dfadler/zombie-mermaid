---
'@zombie-mermaid/ascii-renderer': patch
'@zombie-mermaid/core': patch
---

Fix diagonal edge-routing arrowheads (`◢◣◤◥`) falling back to an unpinned
system font in ASCII output: JetBrains Mono NL has no glyph for them at
all (#1062), so `drawArrowHead` now draws `↖↗↘↙` instead — real,
correctly-directional glyphs the font does have. Also fixes an
`isWideChar` misclassification the new glyphs would otherwise hit.
