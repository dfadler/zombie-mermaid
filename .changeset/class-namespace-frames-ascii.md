---
'@zombie-mermaid/ascii-renderer': patch
---

Class diagram ASCII output now draws `namespace Name { ... }` blocks as a titled frame around their member classes. Members of a namespace are kept next to each other in their row, a relationship crossing a frame keeps its stroke, and the title slides clear of it.
