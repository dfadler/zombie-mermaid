---
'zombie-mermaid': patch
---

ASCII sequence diagrams: an `actor`-typed participant (mermaid's `actor` keyword, a stick figure in the real SVG) now renders with rounded box corners, visually distinct from a plain `participant`'s square-cornered box. Previously the parsed `actor`/`participant` distinction was never read by the ASCII renderer, so both rendered byte-for-byte identically.
