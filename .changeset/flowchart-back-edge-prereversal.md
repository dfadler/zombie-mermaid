---
'@zombie-mermaid/svg-renderer': patch
---

A flowchart with a cycle is no longer drawn upside down when ELK reverses the wrong edge. Cycles are now broken the way mermaid.js breaks them: a depth-first walk reverses the edge that points back at a node still on the walk's stack, and ELK is given those edges already reversed (each is flipped back afterwards, so it still runs from its source to its target). In the Git Branching sample the flow now reads left to right from `main` through `develop` and the feature branches to `PR Review`, instead of starting with `Tests?` at the far left. State diagrams and graphs with a subgraph direction override are unchanged.
