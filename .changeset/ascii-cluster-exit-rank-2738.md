---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: a node linked from inside a subgraph now ranks below the whole subgraph, in the same row as the subgraph's own exits, and a member's own targets sit left of the subgraph-addressed ones, like mermaid@12.3.0, instead of beside the subgraph at the linking member's rank. The exits' horizontal run no longer lies along the row other arrowheads end on. Refs #2738.
