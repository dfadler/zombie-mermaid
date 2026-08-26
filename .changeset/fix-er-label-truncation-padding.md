---
'zombie-mermaid': patch
---

Fix ASCII/Unicode ER diagram relationship labels being truncated and rendered flush against entity boxes. Labels longer than the fixed inter-entity gap (e.g. `"ordered in"`) were silently cut off (`ordere`); the gap between entities is now widened to fit the full label, matching the "widen to fit" convention already used for flowchart edge labels. Relationship labels and cardinality glyph clusters (`││───○╟`) also now keep at least 1 char of padding from both entity box borders instead of sitting flush against them. Diagrams with short labels that already fit the default gap are unaffected and stay compact.
