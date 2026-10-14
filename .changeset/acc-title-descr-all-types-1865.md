---
'@zombie-mermaid/core': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
---

Support Mermaid's `accTitle:` / `accDescr:` (single-line and `accDescr { ... }`) on every diagram type, not just pie. In SVG, `accTitle` names the root (the `title` option still wins) and `accDescr` becomes `<desc>` with `aria-describedby`; both go through the one `svgOpenTag()`. ASCII output ignores the statements and is byte-identical. New `extractAccessibility()` in `@zombie-mermaid/core`.
