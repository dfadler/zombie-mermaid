---
'@zombie-mermaid/svg-renderer': patch
---

Output change: flowchart SVG self-loops sit where Mermaid 12.3.0 draws them: on the node's left face in TD/BT and its top face in LR/RL, as a squared bulge 20px out, with the label outside the bulge and repeated loops stacked outward. Previously every loop was a half-ellipse on the right face.
