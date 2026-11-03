---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII sequence: nested blocks now nest. An inner `loop`/`opt` is drawn inside the `alt` that contains it, with its walls inside the outer walls, instead of above it (#2497).
