---
'zombie-mermaid': patch
---

Fix two ASCII edges running in opposite directions between the same pair of side-by-side nodes (`A -- req --> B` alongside `B -- res --> A`) compositing their labels onto one line and dropping an arrowhead. They now get separate lanes, the same treatment same-direction parallel edges already got. Refs #629.
