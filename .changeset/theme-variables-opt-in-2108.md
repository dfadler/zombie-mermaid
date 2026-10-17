---
'@zombie-mermaid/core': minor
'@zombie-mermaid/mermaid-parser': minor
'@zombie-mermaid/svg-renderer': minor
'@zombie-mermaid/ascii-renderer': minor
'zombie-mermaid': minor
---

New opt-in render option `honorThemeVariables` (`RenderOptions` and `AsciiRenderOptions`, default `false`) that applies a small subset of a diagram's own `%%{init: {"themeVariables": {...}}}%%`: `primaryColor` (node fill, `surface`), `primaryBorderColor` (`border`) and `primaryTextColor` (`fg`) under `theme: "base"`, `lineColor` (`line`; flowchart under any theme, state diagram under `base`), and `pie1`..`pie12` (pie slices and legend, any theme). A colour you pass yourself always wins over the diagram's, invalid or unsafe values are ignored rather than thrown, and every other `themeVariables` key is reported in `InitConfig.ignored` as `themeVariables.<name>` instead of vanishing silently. Mermaid's derived colours (secondary/tertiary, the `base` border gradient, the other pie slices) are not computed. ASCII maps `lineColor`, `primaryBorderColor`, `primaryTextColor` and the pie colours, hex values only; `primaryColor` has no ASCII meaning. Checked against mermaid 12.1.0 and 12.2.0. With the option off, output is byte-identical (checked by hashing every gallery sample and ASCII testdata input, SVG and ASCII, before and after). New exports: `applyThemeVariables()` and the `ThemeVariables` type in `@zombie-mermaid/core`, `PieChart.sliceColors` in `@zombie-mermaid/mermaid-parser`. Closes [#2108](https://github.com/dfadler/zombie-mermaid/issues/2108).

Level: minor. Per [the versioning policy](https://github.com/dfadler/zombie-mermaid/blob/main/docs/decisions/versioning-and-deprecation-policy-1568.md) section 1, a new opt-in option is a minor change; nothing existing changes behaviour.
