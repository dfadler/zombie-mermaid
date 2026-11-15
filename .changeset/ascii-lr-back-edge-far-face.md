---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change, ASCII: in a left-to-right or right-to-left flow, a labelled back edge whose reverse edge shares its route now enters the far face of its target, where ELK and mermaid@12.3.0 end it, when that face holds three ends or fewer. Before, it was drawn as a U into the bottom face and shared an arrowhead with the edge beside it. State: Connection Lifecycle with `direction LR` or `RL` (`Reconnecting --> Connected`) is the diagram that changes.

Output change, ASCII: in a left-to-right or right-to-left flow, a node that ELK ends more than three edges on one side face now grows a row per end, so every end lands on that face with a cell of its own instead of spilling into the top or bottom face. The `ascii-longest-path-layering` hub (six ends on one face) and State: Connection Lifecycle's `Closed` are the diagrams that change.
