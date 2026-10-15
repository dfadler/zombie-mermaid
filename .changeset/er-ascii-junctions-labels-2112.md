---
'zombie-mermaid': patch
---

ER diagrams in ASCII/Unicode now route vertical relationships legibly. Where two edges cross, the cell is a junction (`┼`, or `+` in the ASCII charset) instead of the later edge erasing the earlier one. Each edge takes its own jog row past the cardinality markers, so no edge runs along an entity's border, and the gap between rows grows by one row per edge that crosses it (plus room for same-row detours). A relationship label sits on its own horizontal run when one is long enough, otherwise beside its own stem with a blank on each side, and is placed only after every line is drawn so it can no longer cover another edge's stem. Rows are further apart when a vertical edge carries a label. Output change: ASCII/Unicode for ER diagrams that have relationships between entities in different rows; flowchart, class, state, sequence and the other diagram types are unchanged, as is every ER SVG. Fixes [#2112](https://github.com/dfadler/zombie-mermaid/issues/2112).
