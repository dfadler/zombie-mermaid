---
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/core': patch
'zombie-mermaid': patch
---

Fix inline SVG palettes leaking between diagrams on one page. Mindmap, pie, xychart and timeline declared their `--*-color-N` custom properties under a bare `svg { }` rule, so the last stylesheet repainted every earlier diagram. The root `<svg>` now carries a `zm-pal-<hash>` class and the properties are declared on it. Output change: those four diagram types gain that class and the selector changes.
