---
'zombie-mermaid': minor
'@zombie-mermaid/core': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
'@zombie-mermaid/mermaid-parser': minor
---

`honorThemeVariables` now defaults to **on**, as in mermaid@12.3.0: a diagram's `%%{init: {"themeVariables": {...}}}%%` colours (`primaryColor`, `primaryBorderColor` and `primaryTextColor` under `theme: base`, `lineColor`, `pie1`..`pie12`, the `quadrant*` colours) now apply without the option. A `bg`, `fg`, `line`, `surface` or `border` you pass still wins. **Behaviour change:** diagrams that carry `themeVariables` render differently than before. To keep the old output, pass `honorThemeVariables: false` to `renderMermaidSVG` / `renderMermaidASCII`.
