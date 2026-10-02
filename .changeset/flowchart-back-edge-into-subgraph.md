---
'@zombie-mermaid/svg-renderer': patch
---

An edge that points back into a subgraph from a node past its end no longer loops around the top of the whole subgraph. In the CI/CD sample, the `No` edge from "QA Approved?" back to "Fix & Retry" ran up the side, over the "CI Pipeline" title and down into the node; it now leaves "QA Approved?" on the side and goes straight up into "Fix & Retry" from below, crossing no other edge. Of the routes that clear every other node, the one with the fewest crossings is used, and ELK's route is kept if none is clear.
