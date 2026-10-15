---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII ER: vertical cardinality markers with a zero-circle (`zero-one`, `zero-many`) now take two rows, like mermaid's own: the tick or crow's foot against the entity box, the circle on the line one row further along instead of beside it. Vertical gaps between rows grow by up to two rows in diagrams that have such a marker (#2083).
