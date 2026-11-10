---
'@zombie-mermaid/core': patch
'@zombie-mermaid/mermaid-parser': patch
---

Packet diagrams: sanitize the `title` the way mermaid 12.3.0 does (`&` shows as `&amp;`, kept tags show as text, scripts and unknown tags are dropped), and read numeric-string init values, truthy `showBits` and any non-`descending` `bitOrder` as mermaid does.
