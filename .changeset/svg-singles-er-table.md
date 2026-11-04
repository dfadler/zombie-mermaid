---
'@zombie-mermaid/svg-renderer': patch
---

Output change: ER entities are drawn as mermaid 12.3.0 draws them: a table with type, name, key and comment columns (the comment column was dropped before), lines between rows and columns, and an attribute-less entity as a taller box with the name centred. Circle (`--o`) and cross (`--x`) terminators use mermaid 12.3.0's `circleEnd-margin` / `crossEnd-margin` size.
