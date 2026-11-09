---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

Flowchart SVG: flowcharts without subgraphs are now laid out with the ELK options mermaid@12.3.0 uses (40px node gap, ELK's own cycle breaking, default thoroughness, self-loops kept in the graph), as flowcharts with subgraphs already were. State diagrams are unchanged.
