---
'@zombie-mermaid/ascii-renderer': patch
---

fix(ascii): fewer crossing and closed-box strokes in dense duplicate-edge graphs (#2071). Output change, only for flowcharts that combine duplicate or reciprocal edges (lanes) with a long edge skipping a level or with self-loops: offset lanes are now routed shortest first, and an unlabelled plain edge that skips a level over lanes it encloses after them, so the longer route runs outside the shorter ones instead of crossing every one; a node with a self-loop also gets one more cell on its lane face, so two lane ends no longer share a stem and close a box. Over 600 seeded random duplicate/reciprocal/self-loop graphs the closed stroke rectangles drop from 207 to 99 (15 to 4 over the 48 in the test); no gallery sample or golden changes. Mermaid 12.1.0, 12.2.0 and mermaid.live draw each duplicate edge as its own path and none of the paths cross in the checked graphs.

Versioning: patch per docs/decisions/versioning-and-deprecation-policy-1568.md section 1, "Output changes": lane placement in a dense graph is not a documented output contract, and the strokes of every edge stay (no edge or arrowhead added or dropped).
