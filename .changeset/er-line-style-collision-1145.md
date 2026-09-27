---
'@zombie-mermaid/ascii-renderer': patch
---

Fix ER diagram relationship lines rendering with the wrong solid/dashed style where two relationships' lines cross ([#1145](https://github.com/dfadler/zombie-mermaid/issues/1145)).

Two relationship lines are allowed to cross in normal ER layout, but the collision guard only protected already-placed label text from being overwritten — it didn't protect an already-drawn line glyph from a *different* relationship's differently-styled line landing on the same cell. Whichever relationship happened to be declared (and so drawn) later in the diagram won the cell outright, regardless of style, so an identifying (solid) relationship's own line could end up showing a dashed glyph purely from draw order. A dashed write can no longer overwrite an already-drawn solid glyph, so the result no longer depends on declaration order; two same-styled lines crossing are still drawn as before.
