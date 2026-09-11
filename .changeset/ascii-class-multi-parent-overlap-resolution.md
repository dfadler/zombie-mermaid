---
'zombie-mermaid': patch
---

Fix ASCII class-diagram layout for multi-child and multi-parent classes (#964, implemented per #972 — see docs/decisions/ascii-class-diagram-x-coordinate-assignment-970.md). Building on #971's single-parent alignment: multiple children sharing the same parent now spread evenly around that parent's box center instead of packing left-to-right from column 0, and a class with more than one qualifying (strictly-shallower) parent now centers on the mean of those parents' box centers instead of defaulting to its plain declaration-order position. Both reuse the same left-to-right compaction pass #971 introduced, so two independently-aligned blocks still never overlap. Every other case (no parents, a rootless relationship cycle) is unaffected.
