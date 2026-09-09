---
'zombie-mermaid': patch
---

Render self-loop edges (`B --> B`) in SVG flowchart and state-diagram output as a rounded loop beside the node, with the label placed clear of the curve, instead of a degenerate 4-point right-angle bracket sitting on top of the node. ELK has no native self-loop layout; self-loops are now excluded from the graph handed to ELK and their geometry is synthesized afterward from final node positions. Closes the follow-up identified in #537's research pass.
