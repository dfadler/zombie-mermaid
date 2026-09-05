---
'zombie-mermaid': patch
---

ASCII flowcharts: an edge label on an edge whose route fell back to a direct path (both L-shaped routes and A\* blocked, e.g. a third edge leaving the same side of a node as two siblings) is now placed on one of the two line legs that actually get drawn, instead of mid-way along the never-drawn diagonal between them — where it landed in open grid next to an unrelated edge's connector (`┆thick` in the "All Edge Styles" gallery sample). Flagged by the weekly form-judge audit (#418).
