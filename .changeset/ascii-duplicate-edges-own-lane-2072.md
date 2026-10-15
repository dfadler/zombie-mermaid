---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: ASCII flowcharts draw every duplicate or reciprocal edge on a lane and arrowhead of its own, as mermaid.js draws one path per edge (checked on mermaid 12.1.0 and 12.2.0). A too-short node face used to draw the later of two identical same-direction edges on its twin's route, so two edges showed as one; the node face now grows to hold every lane of every neighbour pair, and the lanes are no longer merged. Only dense graphs of duplicates between three or more nodes change (no gallery sample or golden file does), and lanes that were merged can now cross. Semver: patch, a layout fix; layout and spacing are not a documented output contract (versioning-and-deprecation-policy-1568, section 1, "Output changes"). Fixes [#2072](https://github.com/dfadler/zombie-mermaid/issues/2072).
