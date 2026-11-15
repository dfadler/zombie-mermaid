---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change, ASCII: in a left-to-right or right-to-left flow, a node that ELK ends more than three edges on one side face (the hub of `ascii-longest-path-layering`, `Closed` in State: Connection Lifecycle) now grows a row per end, and each end takes a row of its own on that face in ELK's order, start then arrival of a reciprocal pair, with its own arrowhead and its own bend column, as mermaid@12.3.0 draws them. Back edges enter that face by the gutter instead of running along the node's wall, their labels sit on the run at the other node, and a labelled reciprocal pair on a face of three ends or fewer no longer shares one cell. State: Connection Lifecycle and `ascii-longest-path-layering` with `direction LR` or `RL` are the diagrams that change.
