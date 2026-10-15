---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII flowcharts: parallel edges past the three cells of a box face no longer merge at the target. A group of five or more plain lanes (and a reciprocal folded into one) lengthens the box face so each lane keeps its own arrowhead, and a group of six or seven cluster exit siblings (up to seven edges in total) spreads over both side faces of the target (#1826, #1743, #1689).
