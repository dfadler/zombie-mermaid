---
'zombie-mermaid': patch
---

Fix the breadcrumb separator on the editor, blog, diagram (detail + hub), and fork-fixes pages, which rendered a literal `"/"` instead of the `ChevronRightIcon` the design canvas specifies — only the dashboard page used the chevron correctly. All five now render `Home › <page>` consistently, matching the dashboard's own `size={12}`/`strokeWidth={2.4}` usage.
