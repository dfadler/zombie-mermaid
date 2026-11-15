---
'zombie-mermaid': patch
'@zombie-mermaid/core': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/ascii-renderer': patch
---

Behaviour change, SVG and ASCII: a `themeVariables.primaryColor`, `lineColor` or `primaryTextColor` that mermaid@12.3.0 cannot parse now throws `MermaidParseError` (`Unsupported color format: "<value>"`, code `UNSUPPORTED_COLOR_FORMAT`) instead of being ignored, as mermaid does. `primaryColor` throws under every theme; `lineColor` and `primaryTextColor` under `theme: base` only. Parsable forms are hex (3, 4, 6 or 8 digits), `rgb()`, `rgba()`, `hsl()`, `hsla()`, CSS names and `transparent`; `oklch()`, `lab()`, `hwb()`, `currentColor` and a value with surrounding spaces throw. `honorThemeVariables: false` never throws. `primaryBorderColor` and the pie and quadrant colours are unchanged. Adds `assertThemeVariableColors` and `isMermaidThemeColor` to `@zombie-mermaid/core`.
