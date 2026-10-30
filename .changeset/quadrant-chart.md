---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
'@zombie-mermaid/mcp': patch
---

Quadrant charts. `quadrantChart` diagrams now parse and render to SVG and ASCII/Unicode text, the first type added under the upstream-types umbrella ([#2085](https://github.com/dfadler/zombie-mermaid/issues/2085)). `DiagramType` gains `'quadrant'` and `detectDiagramType` routes a `quadrantChart` header to it (case-sensitively, as Mermaid's detector does). `@zombie-mermaid/mermaid-parser` adds `parseQuadrantChart` with the `QuadrantChart` and `Positioned*` types: `title`, one- or two-sided `x-axis` / `y-axis`, `quadrant-1` to `quadrant-4`, `label: [x, y]` points (coordinates `0`, `1` or `0.<digits>`, as in Mermaid's grammar), `classDef` and `:::class`, the four point styles with Mermaid's validation messages, and `accTitle` / `accDescr`. The SVG uses Mermaid's 500 x 500 geometry, checked against mermaid 12.2.0, and the theme's colour variables; points without a colour are drawn in the foreground colour because Mermaid 12.2.0's default theme emits an invalid `hsl(240, 100%, NaN%)` fill there. The ASCII output is this library's own design (Mermaid has none): a four-cell grid with numbered point markers and a legend. Not read yet: `quadrantChart` config in `%%{init}%%` and the quadrant theme variables; there is no layout oracle for this type yet, so support is partial in that respect (see `docs/known-differences.md`).
