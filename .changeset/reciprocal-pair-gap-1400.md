---
'@zombie-mermaid/ascii-renderer': patch
---

Fix ASCII diagrams where the down and up strokes of a reciprocal pair on one node side (such as Busy and Err in the state-diagram samples) ran only one blank cell apart and read as one edge. They now keep a clear gap where the node border has room. Closes #1400.
