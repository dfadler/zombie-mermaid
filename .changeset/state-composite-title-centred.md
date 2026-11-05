---
'@zombie-mermaid/svg-renderer': patch
---

Output change: an SVG state composite is drawn as mermaid@12.3.0 draws it: rounded outer box, a 26px title band with a centred regular-weight title, a body rect that stops 4px short of the bottom edge, and a cycle inside it keeps source order (the back edge is reversed, so the start dot sits above the first state). State boxes are at least 136x40, start/end markers are 14px circles, and a state diagram is spaced as Mermaid spaces it (40px between ranks, 24px inside a composite, 24px side padding). Flowchart subgraphs are unchanged.
