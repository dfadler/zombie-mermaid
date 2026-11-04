---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: a nested sequence block (`loop`/`opt` inside `alt`) is now inset by one blank column from its container's walls, as Mermaid insets nested frames, instead of drawing its wall directly against the container's. Notes inside nested blocks keep their clearance.
