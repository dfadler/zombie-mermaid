---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

Output change, SVG: a state diagram's `[*]` start or end dot that joins a composite state now sits on the composite's centre line, in the same column or row as the edge that leaves it. Before, the dot sat about 3px to one side, because the centring step only looked for the neighbour among plain nodes and a composite is a group.
