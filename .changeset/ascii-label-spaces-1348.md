---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: a space inside an edge label is no longer replaced by the stroke the label sits on, so `long label` is drawn as `long label` rather than `long─label` (#1348).
