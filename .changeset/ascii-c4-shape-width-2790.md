---
'@zombie-mermaid/ascii-renderer': patch
'@zombie-mermaid/core': patch
'@zombie-mermaid/svg-renderer': patch
---

Output change: C4 ASCII breaks rows on each shape's layout width, as Mermaid 12.3.0 does, instead of a fixed 216px. A tall queue's caps widen its slot, so four of them wrap to rows of three and one. The C4 geometry (`C4`, `c4ShapeSize`, `c4TextWidth` and friends) now lives in `@zombie-mermaid/core` so both renderers share it.
