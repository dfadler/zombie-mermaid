---
'zombie-mermaid': minor
---

ER: every cardinality pairing mermaid.js accepts now parses (`o|--||`, `o{--o{`, the `.-` and `-.` line forms, and word forms such as `one to many` or `1 to 0+`), and a relationship-shaped line that does not parse (`||-||`, `||==o{`) now raises a line-level error instead of being silently dropped (#1747, #1748).
