---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: edges that leave one node port in the same direction and bend the same way at different distances (for example `develop` to `feature/ui` and `release/1.0` in the git branching sample) now each leave by a stem of their own, one stroke spacing apart, instead of the nearer bend riding the whole stem of the farther one. Edges that bend at the same distance or the other way still share one trunk, and a node border too narrow for every stem keeps the shared trunk (#1308).
