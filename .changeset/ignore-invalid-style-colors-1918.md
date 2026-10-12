---
'@zombie-mermaid/core': patch
'@zombie-mermaid/svg-renderer': patch
---

Output change: an invalid `fill`, `stroke` or `color` value in a flowchart, state or class diagram `style`, `classDef` or `linkStyle` (`fill:notacolor`, `fill:rgb(x)`, `stroke:#12345`) is now ignored, as Mermaid does, instead of being written into the SVG as `fill="notacolor"`, which browsers paint as a black node, no border or no link line. Only the bad declaration is dropped; the other declarations in the same rule and the theme paint stay. Valid CSS colours (hex, named, `rgb()`, `hsl()`, `oklch()`, `color()`, `var()`, `color-mix()`, `none`, `transparent`, `currentColor`) are unchanged, and ASCII output is unchanged. State `classDef` is covered as well: it started painting a bad colour when state styling was added in 3.2.0. Fixes [#1918](https://github.com/dfadler/zombie-mermaid/issues/1918).
