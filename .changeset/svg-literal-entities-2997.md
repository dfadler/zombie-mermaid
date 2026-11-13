---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

SVG: a typed `&lt;` or `&amp;` in pie, packet, gantt, timeline, xychart, sankey, radar and sequence text is drawn as typed, as mermaid@12.3.0 does, instead of being decoded before parsing. HTML-label diagram types still decode.
