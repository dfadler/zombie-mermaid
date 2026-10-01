---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII flowcharts with `direction: BT` now keep multi-line node labels intact when a line is blank or shorter than its neighbour (a blank line no longer swaps the paragraphs around it, and a wide first line is no longer split across rows), and a `-` or `|` inside a node label is no longer left behind when the label moves.
