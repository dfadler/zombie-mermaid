---
'zombie-mermaid': patch
---

ASCII ER diagram renderer: horizontal crow's-foot cardinality markers whose own edge glyph collides with the entity border character (`one`/`zero-one`, both `│`/`|`) are inset one cell from the border, instead of sitting flush against it. Markers that don't share a glyph with the border (`many`/`zero-many`, `╢`/`╟`/`○╢`/`○╟`) stay flush — an earlier version of this change inset every horizontal marker unconditionally, which added an unrequested gap to markers that were never ambiguous (e.g. `CUSTOMER }o--o{ ORDER`, no collision on either side). This is a readability adjustment, not a defect fix — issue #413 reclassified the flush-vs-inset question as a subjective style choice after confirming both render legibly in a real terminal — narrowed to apply only where the reviewer's own concern (a marker glyph matching the border glyph) actually occurs. Vertical markers (already flush against `─`, with no border-glyph collision) are unaffected.
