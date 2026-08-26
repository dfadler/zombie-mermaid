---
'zombie-mermaid': patch
---

Fix ASCII/Unicode subgraph title rows sometimes rendering with no left padding at all (e.g. `│Second │` instead of a title that, like every other row in the box, never touches the border). The old centering formula in `drawSubgraphLabel` always gave any unavoidable leftover column to the *right* side of the title, which could zero out the left padding whenever the label length and the box's interior width had opposite parity. It now biases the leftover column to the right side's padding instead, guaranteeing at least one space of left padding whenever the box has any slack.
