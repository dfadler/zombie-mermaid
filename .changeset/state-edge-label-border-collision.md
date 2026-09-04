---
'zombie-mermaid': patch
---

ASCII renderer: an edge label could be centered on the single-grid-step segment that connects a routed path straight into a node's own border (e.g. the box-start connector), landing the label text exactly on top of the border glyph and erasing it instead of leaving the border intact. `determineLabelLine` now excludes both the first and last segment of a path (either endpoint of which touches a node's border) from label placement, not just the first — fixing, for example, the `done` edge label overwriting the `Closed` state box's right border in the "Connection Lifecycle" state-diagram sample. Fixes #450.
