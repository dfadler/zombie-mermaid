---
'zombie-mermaid': patch
---

ASCII renderer: fixed `erDiagram` vertical relationships whose "one" (`||`) cardinality marker sat on the upper or lower entity rendering completely invisible. `getCrowsFootChars` was reused verbatim for both horizontal and vertical markers; on the horizontal axis a `│`/`|` tick is perpendicular to the line it crosses and reads correctly, but on the vertical axis that same tick is parallel to the vertical connecting line, so the marker glyph and the plain line-fill glyph were identical — drawing the marker produced no visible change at all. A vertical "one" marker now renders as `─`/`-`, crossing the line instead of blending into it. `zero-one`, `many`, and `zero-many` markers were unaffected and are unchanged.
