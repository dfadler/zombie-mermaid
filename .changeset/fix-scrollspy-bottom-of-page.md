---
'zombie-mermaid': patch
---

Demo site: fix the sidebar scroll-spy leaving the second-to-last sample highlighted instead of the last one when scrolled all the way to the bottom of a category. A last sample shorter than the gap between the detection line and the viewport bottom never scrolled its top past the line, so it was never picked up. No library API changes.
