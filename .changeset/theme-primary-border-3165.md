---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
'@zombie-mermaid/core': patch
---

Output change, SVG and ASCII: `themeVariables.primaryColor` set alone (under `theme: base`) now also gives the node border the colour mermaid@12.3.0 derives from it (the hex, `rgb()` or `hsl()` colour with saturation 40 points and lightness 10 points lower), instead of leaving the default border. A named colour (`red`) still leaves the border at the default. `primaryBorderColor` and the `border` render option still win. mermaid@12.3.0 does not derive the flowchart line or text colour from `primaryColor`. Adds `deriveBorderColor` to `@zombie-mermaid/core`.
