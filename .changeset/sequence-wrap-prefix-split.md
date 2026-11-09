---
'zombie-mermaid': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
---

Sequence diagrams: a `wrap:` / `nowrap:` prefix on a message or note now wraps (or keeps whole) that label and is no longer drawn, overriding `sequence.wrap`, as in mermaid 12.3.0. A block tab or divider label word wider than the frame is split mid-word with a trailing `-` in SVG and ASCII, as mermaid's `breakString` does.
