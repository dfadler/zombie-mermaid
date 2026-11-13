---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/mermaid-parser': patch
---

Sequence SVG: with `wrap` on, a word wider than the wrap width in a message, note or participant name splits mid-word with a trailing `-` as mermaid@12.3.0's `breakString` does, and a `wrap:` prefix or init `wrap` now wraps a participant name (its box grows taller) instead of leaving it on one line.
