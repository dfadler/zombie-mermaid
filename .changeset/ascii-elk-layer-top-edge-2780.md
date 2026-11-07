---
'zombie-mermaid': patch
---

Output change: with the ELK layout hints, nodes of different heights in one rank (a decision beside shorter boxes, ER entities of different sizes) now share that rank, as in Mermaid 12.3.0, instead of being split into separate ranks. ELK aligns a rank's leading edge, so the layer grouping now accepts a shared leading or trailing edge as well as a shared centre.
