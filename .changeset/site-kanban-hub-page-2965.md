---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

Site: add a `/diagrams/kanban.html` hub page (source, rendered SVG, theme pages, per-sample pages) with its hub card, gallery tile and icon. Kanban SVG: a board with ticket links no longer sets `role="img"` on the root, which hid the focusable links from assistive tech (axe `nested-interactive`).
