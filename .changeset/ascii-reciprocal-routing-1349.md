---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: the return edge of a reciprocal pair (`A --> C` with `C --> A`) is no longer routed as a long detour round the far side of the diagram. When both routes are a straight line or a single bend, the pair may share grid cells, because the strokes are already drawn apart at their ports; the chain-overlap rule that forced the second edge around the first now applies to such a pair only when its routes are longer (#1349).
