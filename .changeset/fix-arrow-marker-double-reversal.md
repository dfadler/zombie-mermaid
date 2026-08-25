---
'zombie-mermaid': patch
---

Fix double-reversed start-arrow markers in SVG output. `orient="auto-start-reverse"` already rotates the arrowhead 180° so it points back out of the source node — but the `arrowhead-start` marker's polygon points were also pre-reversed, canceling out the rotation. The arrowhead ended up pointing into the line instead of away from it, which some renderers (librsvg, Inkscape) render as an invisible/degenerate marker. Both the default and per-color (`linkStyle`) marker variants had the bug; both are fixed by sharing one polygon between the forward and reverse marker.
