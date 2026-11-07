---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: in a top-down or bottom-up flowchart, each bent edge between two layers now gets a bend row of its own, as in Mermaid 12.3.0, instead of sharing one row with the other strokes out of the same face. A labelled reciprocal pair (`A -->|x| B` with `B -->|y| A`) takes ELK's faces and order, the outermost strokes bend nearest the node and the inner ones below them, so labels no longer print over each other and the `┼` where strokes met is gone. The gap between the layers grows to hold the rows.
