---
'zombie-mermaid': patch
---

Sequence diagrams: `alt`, `loop`, `opt`, `par`, `critical` and `break` blocks now lay out their labels the way mermaid.js 12.2.0 does. The tab holds only the block type, the `[label]` is centred beside it, each divider label is centred on its own row above its message, and the frame hugs its outermost lifelines instead of the actor boxes. In ASCII, participants spread apart to fit a long label rather than the wall growing past the last lifeline.
