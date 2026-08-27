---
'zombie-mermaid': patch
---

Fix class and ER diagram ASCII boxes overflowing their own borders when they contain CJK, fullwidth, or other wide characters.

`drawMultiBox` measured text with `line.length` and wrote it one UTF-16 code unit per grid cell, so a wide glyph — which occupies two terminal columns — was sized as one. The same code-unit arithmetic was duplicated in `class-diagram.ts` and `er-diagram.ts`, which precompute box dimensions to reserve grid space before drawing, and in both renderers' relationship-label placement.

All of these now measure display width. The box-sizing arithmetic is consolidated into a single `measureMultiBox` helper that `drawMultiBox` and both callers share, so the space reserved by layout and the box actually drawn can no longer disagree — a desync that silently ate the gap between adjacent boxes.

This completes for multi-compartment boxes what #66 fixed for single boxes.
