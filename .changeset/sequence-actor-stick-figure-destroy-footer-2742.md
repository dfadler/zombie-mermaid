---
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change: sequence diagrams match Mermaid 12.3.0 for `actor` and `destroy`. An `actor` is drawn as a stick figure (head circle, torso, arms, two legs, 2px strokes) instead of a person-in-a-circle icon. A destroyed participant gets a footer box centred on its destroying message, with the lifeline ending at its top and no cross (SVG and ASCII); an arrow to or from it stops at the box edge.
