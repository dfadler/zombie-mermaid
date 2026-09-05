---
'zombie-mermaid': patch
---

ASCII ER diagrams: when two or more vertical relationships attach to the same side of an entity (e.g. two edges both converging on `COMMENT`'s top edge), each relationship now gets its own attachment point spread across the entity's width instead of every attachment defaulting to dead center. Previously the markers landed on the identical cell and merged into what looked like a single relationship.
