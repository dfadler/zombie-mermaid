---
'@zombie-mermaid/ascii-renderer': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
---

Output change: the `c4` block of `%%{init}%%` and front-matter `config:` is read. `diagramMarginX`, `diagramMarginY`, `c4ShapeMargin`, `c4ShapePadding`, `width`, `nextLinePaddingX` and `wrap` change the layout as in mermaid 12.3.0 (SVG, and where rows break in ASCII); keys that change nothing in mermaid stay ignored. `@zombie-mermaid/core` exports `InitConfig.c4Layout`, `C4InitLayout` and `c4Config`; `C4Diagram` gains `layout`.
