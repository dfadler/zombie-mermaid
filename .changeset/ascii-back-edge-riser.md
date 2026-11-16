---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change, ASCII: in a left-to-right or right-to-left diagram, a back edge whose two ends mermaid@12.3.0's layout puts a node apart on the cross axis now keeps them on separate rows, and runs on a row of its own with its riser beside the target, as mermaid draws it. Before, both ends snapped to one row, so the jog beside the source was as long as the riser. CI/CD Pipeline's `Fix & Retry` back to `Push Code` (the `ascii-feedback-edge-sibling-order` fork fix) is the case that changes.
