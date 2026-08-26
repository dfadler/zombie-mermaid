---
'zombie-mermaid': patch
---

Fix ASCII/Unicode-charset box borders misaligning when a node label, edge label, or subgraph title contains CJK/kana/hangul/fullwidth-form or emoji characters. The ASCII grid is column-major with one grid cell per JS code point, but wide characters like these render as **two** columns in a real monospace terminal — so box width (previously computed via `.length`, i.e. UTF-16 code units) was undercounted, and right borders ended up narrower than the label they were supposed to enclose.

Both the sizing and drawing sides are now display-width-aware, reusing the same wide-character detection (`isWideChar`, extracted from the existing SVG text-metrics `isFullwidth`/emoji logic) via a new shared `src/ascii/display-width.ts` module:

- `displayWidth()` replaces `.length` everywhere a label's rendered width is measured for box/column sizing (`multiline-utils.ts`, `shapes/rectangle.ts`, `shapes/stadium.ts`, `shapes/special.ts`, edge-label column reservation in `edge-routing.ts`, edge-label centering in `draw-arrows.ts`, and subgraph-title centering in `draw-subgraphs.ts`).
- `toDisplayCells()`/`drawText()` write each wide character into the grid as two cells (the glyph plus a placeholder), so cell count matches display-column count and the character-writing math agrees with the box-width math.

Example — `A[日本語テスト] --> B[終了]` in both charsets now renders with every row occupying the same 16 terminal columns instead of the label row silently overflowing its own border.
