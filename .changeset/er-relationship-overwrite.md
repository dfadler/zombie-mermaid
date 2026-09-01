---
'zombie-mermaid': patch
---

ASCII `erDiagram` rendering: a relationship's connecting line, crow's-foot marker, or label could silently overwrite a character already placed by an earlier relationship's label (or an entity's own header/attribute text), corrupting it — a stray line glyph mid-word, or two overlapping labels splicing into a new, plausible-looking but bogus word. Relationship draws now skip a cell (or, for a whole label, skip the whole label) rather than overwrite already-placed text.
