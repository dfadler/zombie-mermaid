---
'zombie-mermaid': patch
---

Rework the samples page's card layout: instead of splitting each sample into three fixed columns (source / SVG / ASCII, ~1/3 width each), source now gets a narrow rail and SVG/ASCII share a single output pane switched with a segmented SVG/ASCII toggle. The active view gets the full remaining width instead of a third of it, and the ASCII view renders at its natural height instead of scrolling inside a fixed-height box. No library API changes.
