---
'@zombie-mermaid/ascii-renderer': patch
---

fix(ascii): draw a back-edge on the flow-axis faces like mermaid (#2121). Output change: a flowchart back-edge between nodes in one column (TD/BT) or one row (LR/RL), such as `c --> a` in `a --> b --> c --> a`, now leaves the source's top (LR: left) face, runs along a lane beside the column (below the row in LR), and enters the target's bottom (LR: right) face, instead of looping out of the side faces (LR: the bottom faces). Its ports sit at the outer end of each face, clear of the forward stems, and TD nodes with such an edge are 7 columns wide so both ports fit a stroke spacing apart. Diagonal back-edges, parallel (duplicate) back-edges and reciprocal pairs keep their previous shape. Checked against mermaid 12.1.0.
