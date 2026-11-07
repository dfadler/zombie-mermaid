---
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change: sequence diagrams match Mermaid 12.3.0 more closely. SVG: an `actor` stick figure is 44px tall (head radius 10.15) with its label 15px below it, as in Mermaid. A self-message that destroys its participant is a straight line to the lifeline with the footer box centred on it (SVG), and in ASCII the footer box is centred on that message's row instead of sitting under a loop.
