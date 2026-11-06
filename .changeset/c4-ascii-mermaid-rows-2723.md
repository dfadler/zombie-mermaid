---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: C4 ASCII places shapes as Mermaid 12.3.0 does: in rows in declaration order (four to a row, boundaries two to a row, a boundary's own shapes above its child boundaries), left-aligned with shapes top-aligned in a row. `Rel_U/D/L/R` and the diagram direction no longer move shapes, as in Mermaid. Routes keep off box sides, and the gap between neighbouring shapes widens to fit the edge label between them.
