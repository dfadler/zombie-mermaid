---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: a duplicate-edge group that runs back over more than one layer in a flowchart or state diagram (`S4 --> S0` twice, with S1 and S2 between) now leaves and enters by the faces Mermaid 12.3.0 uses, each end on a cell of its own with its own jog column, and in a left-to-right or right-to-left flow the planner gives every Z-shaped edge its own bend column, as top-down already did. A label on a bent edge sits on its long horizontal run, not on the vertical between two short ones. A face that takes more ends is made longer to hold them. This completes `ascii-label-canvas-edge`: `e0` and `e1` print whole, with no `┼`.
