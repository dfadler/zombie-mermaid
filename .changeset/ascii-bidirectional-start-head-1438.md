---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: a bidirectional edge's start arrowhead no longer overwrites the source node's border. It now sits in the first stroke cell, mirroring the end arrowhead, and the border keeps a tee where the stroke leaves. A labelled horizontal bidirectional edge gets one extra column so the label does not cover the start head (fixes #1438).
