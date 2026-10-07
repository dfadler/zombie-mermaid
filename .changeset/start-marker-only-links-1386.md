---
'zombie-mermaid': patch
---

A start marker with no matching end marker (`A <-.- B`, `A <--- B`, `A o--- B`, `A o--x B`) is now dropped, as Mermaid does, so the link renders without it instead of drawing a lone start arrowhead. Paired markers (`<-->`, `<-.->`, `o--o`, `x--x`) are unchanged.
