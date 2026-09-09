---
'zombie-mermaid': patch
---

Fix the "See all samples" CTA on diagram-type pages (e.g. `diagrams/flowchart.html`) pointing at `../#samples-heading`, a fragment that no longer exists after the #590 Diagram-Native Showcase redesign replaced the old interactive sample gallery. It now points at the Diagrams hub (`diagrams/index.html`), matching the page's own breadcrumb.
