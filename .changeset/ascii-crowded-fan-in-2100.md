---
'@zombie-mermaid/ascii-renderer': patch
---

fix(ascii): give every edge into a crowded top face a stroke and an arrowhead of its own (#2100). Output change: in a TD/BT flowchart, a node that takes edges from two or more sources above it and also sends an edge up to a node above it (`a --> c`, `b --> c` beside `c --> a`) no longer bundles those arrivals onto one trunk with one shared arrowhead. The node is widened so each end has a cell, the reciprocal pair sits either side of the centre, and the other arrivals land beyond them. A fan-out into such a node is split too, so `b --> a` and `b --> c` leave `b` on their own strokes. Fan-ins with labels that land on a port which also starts an edge now keep one arrowhead each instead of merging. Duplicate (parallel) edges, LR/RL layouts and every other gallery sample and golden are unchanged. Self-loop placement (left face in mermaid TD/BT, top face in LR/RL) is a documented difference (#2101). Checked against mermaid 12.1.0 and 12.2.0.

Versioning: patch per docs/decisions/versioning-and-deprecation-policy-1568.md section 1, "Output changes": layout, spacing and glyph changes are not documented output contracts, and this corrects merged arrowheads.
