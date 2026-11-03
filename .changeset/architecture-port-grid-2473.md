---
'zombie-mermaid': patch
'@zombie-mermaid/core': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
---

SVG architecture diagrams now keep services that are not in a group where their ports put them, as Mermaid does: `a:R -- L:b` neighbours share a row, and `a:B -- T:b` puts `b` straight under `a`. Previously the layered layout staggered side-linked services and laid top/bottom links out along the flow. Against mermaid 12.2.0, the Services And Edge Sides sample goes from 81% to 100% vertical and horizontal placement agreement. Services inside groups are unchanged (#2473).
