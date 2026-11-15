---
'zombie-mermaid': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
---

Block diagram node shapes and block arrows ([#3106](https://github.com/dfadler/zombie-mermaid/issues/3106)). `a(("x"))` circle, `a((("x")))` double circle, `a{"x"}` diamond, `a{{"x"}}` hexagon, `a(["x"])` stadium, `a[["x"]]` subroutine, `a[("x")]` cylinder, `a>"x"]` asymmetric, `a[/"x"/]` `a[\"x"\]` leaning boxes, `a[/"x"\]` `a[\"x"/]` trapezoids and `a<["x"]>(right, down)` block arrows now parse and draw as Mermaid 12.3.0 does: each shape's natural size, its second-pass geometry in a wider cell, and its own outline for link clipping. `BlockShape` grows the shape names, `BlockNode` gains `directions` and `PositionedBlockNode` gains `geometry`. The ASCII renderer gives each shape the delimiters the flowchart renderer uses. `pnpm run block:oracle` compares each shape's centre and circle radii, polygon points or cylinder path, and now scores a case per shape.
