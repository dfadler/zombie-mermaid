---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

SVG flowcharts: an arrowhead is coloured with the `linkStyle default` stroke when there is one, and otherwise with its own edge's `linkStyle` stroke, as in mermaid 12.2.0 (a regression from the earlier change that tinted heads only from `linkStyle default`) (#2476).
