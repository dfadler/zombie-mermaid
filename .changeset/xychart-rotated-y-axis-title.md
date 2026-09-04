---
'zombie-mermaid': patch
---

Fix ASCII `xychart-beta` rendering dropping the rotated y-axis title entirely. It now renders as a vertical (top-to-bottom, one character per row) label along the left margin, matching how mermaid.js visually rotates it 90 degrees in SVG output.
