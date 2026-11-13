---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

Radar ASCII: a curve with a different number of values than there are axes is listed under the bars with its fill glyph (with `showLegend` on), as mermaid@12.3.0 lists it in its legend while drawing no polygon. It was dropped silently. The SVG already matched; four more cases (fewer values, more values, only a short curve, short curve with `showLegend false`, `min`/`max`, polygon graticule) are now checked against 12.3.0 in the radar oracle.
