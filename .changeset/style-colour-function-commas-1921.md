---
'@zombie-mermaid/core': patch
---

Output change: `style`, `classDef` and `linkStyle` values now keep commas inside `(...)` and quotes, so `style A fill:rgb(255,0,0)`, `stroke:hsl(0,100%,50%)`, `stroke:rgba(0,0,0,.5)` and `fill:color-mix(in srgb, red 50%, blue)` paint the colour instead of losing it. Mermaid 12.1.0 itself rejects these in flowcharts and drops them in state and class diagrams, so this is a superset. Declarations without such commas parse as before, and ASCII output is unchanged. Fixes [#1921](https://github.com/dfadler/zombie-mermaid/issues/1921).
