---
'zombie-mermaid': patch
---

ASCII sequence diagrams: an `alt`/`else` (and `loop`/`opt`/`par`) block's wall is now widened to fit its longest header or divider label instead of hard-truncating it mid-word. The wall was previously sized only from the span of the lifelines/self-arrows the block's messages touch, with no relationship to label length — a condition label longer than that span lost its tail with no ellipsis or other marker, and because the cut landed mid-word the truncated text could still read as a complete (but wrong) phrase, e.g. `alt [credentials` instead of `alt [credentials valid]`.
