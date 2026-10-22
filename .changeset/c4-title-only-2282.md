---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
---

C4: a title-only diagram (`C4Context` with just a `title`) now draws the title inside a canvas sized to it, in SVG and ASCII, instead of a 0x0 viewBox and empty output (#2282).
