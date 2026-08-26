---
'zombie-mermaid': patch
---

Fix a stray `├` (tee) character on flowchart decision-node edge labels in the ASCII/Unicode renderer, `LR` direction with the default Unicode box-drawing charset (#86). The box-start connector for an edge exiting a node's right/left/top/bottom border always emitted a junction character, even when the grid cell it landed on had no real perpendicular border line to merge with — producing a disconnected `├`/`┤`/`┬`/`┴` glyph with blank cells on both sides instead of a plain line. It now only emits a tee/junction character when a genuine border line is actually present at that cell, falling back to a plain `─`/`│` line character otherwise.
