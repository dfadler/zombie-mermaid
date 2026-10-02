---
'@zombie-mermaid/svg-renderer': patch
---

Flowchart edges no longer run across a subgraph's title text. An edge that comes down over the top of a subgraph to reach a node inside (the `No` edge into "Fix & Retry" in the CI/CD sample, the edges into the "US West Region" and "US East Region" subgraphs) is now moved sideways, clear of the title; if the target is too narrow or a node is in the way, it enters through the side wall below the title bar instead.
