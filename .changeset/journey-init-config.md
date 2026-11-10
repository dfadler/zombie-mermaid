---
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/core': patch
---

Journey diagrams read `width`, `height`, `taskMargin`, `diagramMarginX`, `diagramMarginY`, `leftMargin` and `maxLabelWidth` from `%%{init}%%`, matching mermaid 12.3.0.
