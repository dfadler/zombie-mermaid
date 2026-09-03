---
'zombie-mermaid': patch
---

ASCII backend, erDiagram: fixed two related layout defects. Crow's-foot cardinality markers no longer leave a stray/duplicated connector glyph next to an entity border — they now sit flush against the border (standard ER notation) instead of inset by one cell of leftover connecting-line fill, which for the single-character "one" marker was visually indistinguishable from the marker itself. Disconnected components are now separated by a compact 2-row gap instead of a fixed 6-row gap that dwarfed small diagrams with mostly blank output. (A third defect, vertical relationships colliding on the same horizontal jog row, was fixed independently on `main` and is not part of this change.) Fixes #351.
