---
'@zombie-mermaid/ascii-renderer': patch
---

Fix `renderMermaidASCII` hanging or throwing `pathCells: segment ... did not reach its endpoint` on a top-down flowchart made of chained fan-outs (`A --> B`, `A --> C`, `C --> D`, `D --> E`, `D --> F`, ...). A parent whose children sat a half column apart was placed on a fractional column; it now stays above its first child instead. Closes #1391.
