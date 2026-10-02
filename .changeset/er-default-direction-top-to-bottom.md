---
'@zombie-mermaid/svg-renderer': minor
---

ER diagrams with no `direction` statement now lay out top to bottom, as official Mermaid does, instead of left to right. Add `direction LR` to the source (or pass the `direction` render option) to keep the old horizontal layout. The ASCII renderer is unchanged.
