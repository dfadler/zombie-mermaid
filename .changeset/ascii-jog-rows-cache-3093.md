---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: a left-to-right or right-to-left flow with several edges leaving one cluster (the "Cluster Exit Siblings" samples) no longer re-runs the same bend-row search hundreds of times while it lays out; the result is unchanged, only faster (one such render dropped from minutes to under a second on a heavily loaded machine).
