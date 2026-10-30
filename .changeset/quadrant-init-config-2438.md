---
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'zombie-mermaid': minor
---

`quadrantChart` now reads its `%%{init}%%` config and theme variables ([#2438](https://github.com/dfadler/zombie-mermaid/issues/2438)). The `quadrantChart` block (`chartWidth`, `chartHeight`, `titleFontSize`, the paddings and label font sizes, `pointRadius`, `xAxisPosition`, `yAxisPosition`, the border stroke widths) sizes and lays out the SVG as in Mermaid 12.2.0; a bad or negative number or an unknown position is ignored. The `quadrant*Fill`, `quadrant*TextFill`, `quadrantPoint*`, axis-text, title and border stroke variables colour the SVG under any theme when `honorThemeVariables` is set. ASCII output is unchanged. `InitConfig` gains `quadrant`, `ThemeVariables` gains `quadrant`, and `QuadrantChart` gains `config` and `themeColors`. The demo pages for the type are not part of this change.
