---
'zombie-mermaid': patch
---

ASCII class diagrams: node level (top/bottom) placement now always follows `from` → `to` edge direction, matching real mermaid.js, instead of special-casing inheritance/realization relationships to place the node by which end the visual marker (hollow triangle) is drawn at. Previously `Bird ..|> Flyable` rendered Flyable above Bird — the reverse of mermaid.js's actual layout — even though the file's own header comment already documented the correct `from`-above-`to` rule.
