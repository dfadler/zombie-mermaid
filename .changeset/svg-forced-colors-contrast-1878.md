---
'@zombie-mermaid/core': patch
---

SVG output now honors `prefers-contrast: more` (faint derived strokes and secondary text go to full foreground) and `forced-colors: active` (they use `CanvasText`). In an SVG loaded as `<img>` only `forced-colors` applies; `prefers-contrast` does not match there (#1878).
