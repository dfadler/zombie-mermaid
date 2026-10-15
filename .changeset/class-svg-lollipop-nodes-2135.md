---
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/mermaid-parser': patch
'zombie-mermaid': patch
---

Class diagrams (SVG): `A ()-- B` and `B --() A` now draw the interface the way mermaid.js does (12.1.0 and 12.2.0 agree): the name sits above or below its host with a small circle and a stem between them, instead of a class box with a circle marker on it. A class used only as an interface end gets no box; one with members, an annotation, another relationship, a note or a namespace keeps it. `()--()` is unchanged. Output change: SVG for any diagram with a one-ended lollipop moves; no other diagram changes. `PositionedClassRelationship` gains an optional `interfaceLabel` (the name's box) for these lines. Closes #2135.

Level: patch. Per [the versioning policy](https://github.com/dfadler/zombie-mermaid/blob/main/docs/decisions/versioning-and-deprecation-policy-1568.md) section 1, SVG layout and glyph changes are not output contracts (the accessibility guarantees, theme keys and documented options are unchanged), and this one brings the output in line with mermaid.js; the new type field is optional.
