---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: every labelled vertical edge now puts its label beside the stroke (down edges to the right, up edges to the left) instead of printing it over the line, when the cells there are free; otherwise the label stays on the stroke as before (#1284).
