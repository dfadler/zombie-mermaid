---
'zombie-mermaid': patch
---

ASCII class diagrams: when more than one relationship connects the same pair of classes (most commonly a reciprocal pair going in opposite directions, e.g. `View --> Model : reads` alongside `Model ..> View : notifies`), each relationship in the group now gets its own connection column instead of all defaulting to the same box-center column. Previously the later-drawn relationship's line, arrowhead, and label silently overwrote the earlier one's, making it disappear from the ASCII output entirely.
