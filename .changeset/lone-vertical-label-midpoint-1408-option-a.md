---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: a lone labelled vertical edge's label now sits on the middle row of the gap, as Mermaid places it, instead of a third of the way down. When that row is where another edge turns (a bypass corner or `├` junction), the label moves up a row so it does not read as part of that line.
