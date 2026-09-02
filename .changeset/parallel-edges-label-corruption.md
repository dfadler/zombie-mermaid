---
'zombie-mermaid': patch
---

ASCII renderer: two or more edges between the same pair of nodes (e.g. `A -->|First| B` followed by `A -->|Second| B`) no longer corrupt each other's labels. Every such edge previously computed the identical center path (`determinePath` had no notion of sibling parallel edges), so only one visible line was drawn and each edge's independently-centered label landed a few columns apart from its sibling's on that shared line — silently overwriting characters (e.g. `First Arrow` and `Second Arrow` rendering as `SFirst Arrow`) instead of either edge winning cleanly. Edges after the first in such a group are now routed through a distinct offset lane, so parallel edges render as visually distinct lines with intact labels.
