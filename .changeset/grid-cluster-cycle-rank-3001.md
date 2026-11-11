---
'@zombie-mermaid/ascii-renderer': patch
---

The plain ASCII grid ranks a cycle through a cluster boundary as mermaid@12.3.0 does when the outside node is declared first: the exit edge back out of the cluster is dropped as the cycle's back edge, and a source with only that cluster below it sits beside the outside node.
