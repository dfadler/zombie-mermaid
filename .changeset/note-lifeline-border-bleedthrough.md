---
'zombie-mermaid': patch
---

ASCII renderer: a sequence-diagram `Note over A,B` box no longer shows a doubled border character when its computed width happens to put one of its own interior padding columns exactly on a lifeline's x-position. Note content rows previously wrote only the border and text characters, leaving padding columns untouched — so a lifeline character painted in the earlier lifelines pass leaked through as a second border glyph right next to the note's real border. The note's interior (content + padding) is now blanked before the text is written.
