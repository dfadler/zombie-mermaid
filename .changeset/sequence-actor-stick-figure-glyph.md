---
'zombie-mermaid': patch
---

ASCII sequence diagrams: a participant declared with mermaid's `actor` keyword now renders with a small stick-figure glyph above its label, distinguishing it from a boxed `participant` — matching real mermaid.js's SVG output, which renders `actor` as a circle-person icon rather than a plain box. Previously `actor` and `participant` rendered byte-for-byte identically in ASCII output even though the parser already captured the distinction. Fixes #449.
