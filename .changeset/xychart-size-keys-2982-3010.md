---
'@zombie-mermaid/core': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
'zombie-mermaid': patch
---

xyChart (SVG): read the font, padding, tick, line-width, rotation and data-label config keys of mermaid 12.3.0: `titleFontSize`, `titlePadding`, `plotReservedSpacePercent`, `showDataLabel`, `showDataLabelOutsideBar`, and per axis `labelFontSize`, `labelPadding`, `titleFontSize`, `titlePadding`, `tickLength`, `tickWidth`, `axisLineWidth`, `labelRotation`. The canvas stays `width` x `height`, and the plot moves by the same amount as in mermaid (within about 1px, checked for each key in both orientations). Charts that set none of them render as before.
