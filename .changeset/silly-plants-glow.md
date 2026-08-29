---
'zombie-mermaid': patch
---

Fix ASCII edge routing silently overlapping two unrelated edges of different line styles (e.g. a solid branch and a dotted retry/back-edge with no shared source or target) through the same grid cells, corrupting the rendered line into a mixed half-solid, half-dotted run with no visual indication that two distinct connections were there. Same-style edges continue to share routing space as before (this is how sibling/bundled edges cleanly merge trunks).
