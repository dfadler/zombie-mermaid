---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: when two or more labelled edges join the same two nodes, a label no longer lands on the cell an earlier sibling's label slid to and overwrites it (`n82` and `C5` printed as `n825`). The later label now avoids the earlier label where it is drawn.
