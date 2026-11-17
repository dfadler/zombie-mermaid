---
'zombie-mermaid': patch
---

Output change, ASCII: in a left-to-right or right-to-left diagram, a lone Z route (one that shares its gap with nothing it could merge with) now bends at the middle of the gap, where mermaid@12.3.0 bends it, instead of a third of the way across. The bend hint is read from a layout with mermaid's real node sizes, and only when it lands at the middle. Bypass edges in a chain and the strokes into a fan-in hub are the cases that change.
