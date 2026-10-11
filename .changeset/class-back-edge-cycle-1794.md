---
'zombie-mermaid': patch
---

Class diagrams: a cycle between classes is now broken the way mermaid.js does it (a depth-first walk in declaration order), so the first-declared class of a 2-cycle sits above the other instead of the mirror image. The MVC sample no longer swaps Model and View (#1794).
