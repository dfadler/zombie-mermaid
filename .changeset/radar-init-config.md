---
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/core': patch
---

Radar diagrams read `width`, `height`, the four margins, `axisScaleFactor`, `axisLabelFactor` and `curveTension` from `%%{init}%%` and front matter `config.radar`, and the `themeVariables.radar` sizes and opacities, matching mermaid 12.3.0.
