---
'@zombie-mermaid/svg-renderer': patch
---

C4 SVG relationships now end on a cylinder (`SystemDb`, `ContainerDb`), a pipe (`SystemQueue`, `ContainerQueue`) and a person where Mermaid ends them, following the shape's own outline at oblique angles instead of the box around it. A line into the top of a database used to stop up to 15px short of where Mermaid ends it.
