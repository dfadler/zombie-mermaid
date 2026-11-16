---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
'@zombie-mermaid/core': patch
---

Output change, SVG only: under `theme: base`, flowchart and state now draw the node and subgraph border as mermaid@12.3.0 does, a left-to-right gradient from the border colour to `primaryColor` with its hue shifted -120°, saturation -40 and lightness -10 (`#fff4dd` when `primaryColor` is unset), instead of a solid stroke. A named `primaryColor` and `honorThemeVariables: false` keep the solid border, and the contrast and forced-colors overrides still replace the gradient. Class and ER do not read `themeVariables`, so they are unchanged; ASCII has no gradient. Adds `deriveBorderGradientEnd` to `@zombie-mermaid/core`.
