---
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
---

Class diagrams: the parser now accepts syntax mermaid.js accepts and it used to reject with an error: the `classDiagram-v2` header (an alias of `classDiagram`), `<|--|>` / `<|..|>` / `<-->` / `<..>` / `*--*` / `o--o` (the marker is drawn at both ends, in SVG and ASCII), lollipop interfaces `()--`, `--()` and `()--()` (a hollow circle at the end of the line: `○`, or `O` with `useAscii`), and backtick-quoted class names such as `` class `Animal Class!` `` (the backticks are not drawn). Nothing that parsed before is rejected, and no existing input renders differently except the output change below; the arrow regex is built from one table, so the error for a malformed relationship now lists the longer arrow set. `ClassRelationship.markerAt` gains `'both'` and `RelationshipType` gains `'lollipop'`. Parity checked against mermaid 12.1.0 (the pin) and 12.2.0.

Output change: in ASCII, a directional arrowhead at the `from` end of a relationship (`A <-- B`, `A <.. B`) now points into the `from` box (`▲` under it) instead of away from it (`▼`). Fixes [#2117](https://github.com/dfadler/zombie-mermaid/issues/2117).
