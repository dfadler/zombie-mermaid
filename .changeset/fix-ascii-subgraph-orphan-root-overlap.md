---
'zombie-mermaid': patch
---

Fix ASCII flowchart rendering where an edge-less node inside a subgraph could merge that subgraph's frame with a neighboring sibling subgraph. `createMapping`'s root-node placement (`src/ascii/grid.ts`) was subgraph-agnostic: an edge-less node (treated as an initial "root" since it has no incoming edges) could land in the same row/column band as an unrelated sibling subgraph's real root, purely because both were "roots." That made one subgraph's bounding box balloon out to enclose the sibling's, corrupting both frames' borders and titles when drawn (e.g. two titles interleaving into garbled text). Root nodes whose subgraph has other, unreachable-from-them members are now deferred and anchored next to their already-placed subgraph siblings instead, keeping sibling subgraphs' bounding boxes disjoint in both `TD` and `LR` directions.
