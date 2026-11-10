---
'zombie-mermaid': patch
'@zombie-mermaid/core': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
---

`gitGraph` reads the `titleTopMargin` (default 25) and `diagramPadding` (default 8) config keys from `%%{init}%%` and front matter, moving the title and the viewBox as mermaid 12.3.0 does (numeric strings and negative numbers included). Part of [#2959](https://github.com/dfadler/zombie-mermaid/issues/2959).
