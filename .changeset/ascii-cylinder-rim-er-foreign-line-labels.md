---
'@zombie-mermaid/ascii-renderer': patch
---

Fix two ASCII structural-fidelity bugs found by the weekly form-judge audit ([#1119](https://github.com/dfadler/zombie-mermaid/issues/1119)):

- A cylinder (database) node rendered identically to a plain rounded node — same corner glyphs, no cylinder-specific marker — because the flowchart drawing path never used the existing `cylinderRenderer`'s rim-line rendering at all; it draws every shape as a bordered rectangle with shape-specific corner glyphs only, and cylinder's corners were identical to rounded's. Cylinder nodes now get a rim line just inside the top and bottom border, using height already reserved for it.
- An ER relationship's label could land directly beside (or, with a short label, directly inside) a *different* relationship's already-drawn connector line, when that spot was otherwise the label's natural placement. Since the foreign line's role wasn't checked as an obstacle, the label search treated it as free space — misleadingly implying the label described that line's solid/dashed style instead of its own. The label search now also avoids a different relationship's own line, falling back to the old, permissive placement only when no row in range clears that stricter bar — so a label is relocated rather than dropped.
