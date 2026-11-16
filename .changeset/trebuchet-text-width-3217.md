---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': patch
'@zombie-mermaid/mcp': patch
---

Output change, SVG: the default font is now mermaid@12.3.0's own stack, `"trebuchet ms", verdana, arial, sans-serif`, and labels are sized with its measured per-character widths (regular and bold) instead of an Inter estimate, as pie already was. Every diagram type's label boxes move, by up to a few pixels for short text and more for wide capitals and digits; flowchart node sizes now match 12.3.0 exactly on the probes (`A[xxxxxxxxxxxxxxxxxxxx]` is 192.3 wide, `Wait Idle Ready` stays on one line). The SVG no longer asks Google Fonts for Inter by default; pass `font: 'Inter'` (or `embedFont: 'subset'`) to keep Inter, which keeps the previous widths. The ASCII renderer keeps its Inter-based layout. New `MERMAID_FONT_STACK`, `isTrebuchetFont` and `setTrebuchetMetrics` exports in core (#3217).
