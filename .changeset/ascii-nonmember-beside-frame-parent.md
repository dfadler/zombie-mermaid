---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII subgraph frames: when a non-member node is moved off a frame, a free-standing parent that only feeds it moves to the same column (row in LR), so `W --> Y` drops straight down instead of wrapping around from W's side.
