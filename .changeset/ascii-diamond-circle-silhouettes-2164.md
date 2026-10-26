---
'zombie-mermaid': minor
'@zombie-mermaid/ascii-renderer': minor
---

ASCII: a diamond `{x}` is now drawn as a rhombus (`╱╲` points at the top and bottom, `<` `>` at the sides, `/\` in the ASCII charset) and a circle `((x))` as an ellipse (rounded top and bottom, `╱ ╲` between, `(` `)` on the middle row), instead of boxes with swapped corner glyphs. The node keeps its rows and widens only as far as its label needs; an edge leaving a point or corner starts beside it instead of cutting it off (#2164).
