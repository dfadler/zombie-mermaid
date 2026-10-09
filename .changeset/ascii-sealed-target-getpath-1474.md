---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: pathfinding gives up immediately when the target cell has no free neighbour, instead of flooding the grid up to the iteration cap. This cuts the A\* work for the "CI/CD Pipeline" sample's style-conflict reroutes from about 150k iterations to under 1k, with no change to rendered output (fixes #1474).
