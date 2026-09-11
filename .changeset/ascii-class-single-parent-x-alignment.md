---
'zombie-mermaid': patch
---

Fix ASCII class-diagram layout placing a lone child at the leftmost column instead of under its real parent (#964, implemented per #971 — see docs/decisions/ascii-class-diagram-x-coordinate-assignment-970.md). A class that's the sole occupant of its level, with exactly one qualifying (strictly-shallower) parent, now aligns its box center under that parent's own box center instead of always packing left-to-right from column 0 — the connector between them is now a short, straight drop instead of a long, confusing horizontal jog. Every other case (no parents, a rootless relationship cycle, or more than one class sharing the same parent set) is unaffected and keeps its existing position; multi-parent convergence and overlap resolution are tracked separately in #972.
