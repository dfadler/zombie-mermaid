---
'@zombie-mermaid/ascii-renderer': patch
---

Fix orphan line stubs in ASCII state diagrams: a side exit from a box whose border column was widened now draws its stroke all the way from the connector (State Notes), and fork/join bars fill their border rows so stems and arrowheads touch the bar.
