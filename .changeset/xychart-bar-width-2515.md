---
'zombie-mermaid': patch
'@zombie-mermaid/core': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
---

SVG xychart bars now follow mermaid 12.2.0's band formula, so their width and gap match mermaid with few and many categories instead of a fixed 40 px cap; `pnpm run xychart:oracle` scores bar width too.
