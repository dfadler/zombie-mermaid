---
'@zombie-mermaid/svg-renderer': patch
---

Output change: a horizontal `xychart-beta` SVG now draws the value axis (line, ticks, labels and title) along the top of the plot, with the category axis on the left, as Mermaid 12.3.0 does; the first and last category of both orientations are inset by the axis' outer padding, as in Mermaid, instead of centred in equal bands.
