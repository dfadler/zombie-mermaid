---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': minor
---

Output change, ASCII: in a left-to-right or right-to-left flow, a node that ELK ends more than three edges on one side face (the hub of `ascii-longest-path-layering`, `Closed` in State: Connection Lifecycle) now grows a row per end, and each end takes a row of its own on that face in ELK's order, start then arrival of a reciprocal pair, with its own arrowhead, as mermaid@12.3.0 draws them. Back edges enter that face by the gutter instead of running along the node's wall, and a labelled reciprocal pair on a face of three ends or fewer no longer shares one cell.

New hint: `AsciiEdgeHint.bend`, where ELK's route bends along the flow axis (0 beside the start face, 1 beside the end face). The ELK provider fills it. A Z-shaped edge in a horizontal flow bends on the side ELK does and puts its label on the long run on the other side. Without a provider the output is unchanged. State: Connection Lifecycle, `ascii-longest-path-layering`, `ascii-label-canvas-edge` and Dense Duplicate Edges change under a provider in LR and RL.
