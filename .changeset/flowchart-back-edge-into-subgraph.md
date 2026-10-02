---
'@zombie-mermaid/svg-renderer': patch
---

An edge that points back into a subgraph from a node past its end no longer loops around the top of the whole subgraph. In the CI/CD sample, the `No` edge from "QA Approved?" back to "Fix & Retry" ran up the side, over the "CI Pipeline" title and down into the node; it now runs just below the subgraph and enters "Fix & Retry" from below, with its label beside the wall. ELK's route is kept when the short route would cross another node.
