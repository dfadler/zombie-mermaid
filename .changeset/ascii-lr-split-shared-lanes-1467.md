---
'@zombie-mermaid/ascii-renderer': patch
---

In LR flowcharts, labeled edges from different sources into one node no longer share a single under-row lane and drop when two or more of them run along the same bent path. Each gets its own lane so its label sits on its own stroke. Plain tee merges and unlabeled fan-in are unchanged. Closes #1467.
