---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

Flowchart SVG: node labels are 16px with a 24px line height and 12px vertical padding, so a one-line rect is 48px high as in mermaid@12.3.0 (was 36.9px at 13px). Diamond, triangle and tagged-rectangle widths follow. State diagrams and `fontSizes.nodeLabel` overrides are unchanged.
