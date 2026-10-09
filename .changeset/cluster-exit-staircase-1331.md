---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: cluster exits no longer share one gutter bus. Each sibling turns off the stub on its own row (TD) or column (LR), farthest target first, so every label reads against its own drop (#1331). A two-exit cluster now takes one more row or column than before.
