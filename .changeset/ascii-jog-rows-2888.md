---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: in a top-down or bottom-up flowchart, bent two-leg edges between two layers (the Z-shaped ones) now get a bend row of their own, as in Mermaid 12.3.0, instead of sharing one row with the other strokes out of the same face; strokes out of one cell still share a trunk row, and a gap with more than 12 such edges keeps its shared rows. A labelled reciprocal pair on one Z route (`A -->|x| B` with `B -->|y| A`) takes ELK's faces and order, so in `ascii-longest-path-layering` the labels no longer print over each other and the `┼` is gone. The gap between the layers grows to hold the rows.
