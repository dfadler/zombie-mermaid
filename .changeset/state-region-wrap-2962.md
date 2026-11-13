---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

State: concurrent regions (`--`) are laid out from the same ELK inputs mermaid@12.3.0 uses (layered, `SEPARATE_CHILDREN`, 24px padding, mermaid's subgraph spacing, written child order) instead of the fork's rectpacking approximation and area pre-sort. Two plain regions now stack in one column, and the column/row shape and smallest-first order follow mermaid's. Against 112 recorded 12.3.0 renders with an unspaced wide-labelled region, the shape differs in 7 (was 53). Not yet matched: wrapped (spaced) wide labels, where 40 of 112 shapes and 7 orders still differ (was 64 shapes), and state node size (a one-node region is 198 x 91.5, mermaid draws 184 x 88). Refs #2962.
