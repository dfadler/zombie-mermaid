---
'zombie-mermaid': patch
---

ASCII backend, erDiagram: fixed three related layout defects. Crow's-foot cardinality markers no longer leave a stray/duplicated connector glyph next to an entity border — they now sit flush against the border (standard ER notation) instead of inset by one cell of leftover connecting-line fill, which for the single-character "one" marker was visually indistinguishable from the marker itself. Vertical relationships between the same pair of component rows no longer collide on the same horizontal jog row (previously every such relationship computed the identical geometric midpoint, so unrelated relationships' jogs and labels overwrote each other or cut through one another's text) — a jog now picks the nearest row that isn't already occupied. Disconnected components are now separated by a compact 2-row gap instead of a fixed 6-row gap that dwarfed small diagrams with mostly blank output. Fixes #351.
