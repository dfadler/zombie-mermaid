---
'zombie-mermaid': patch
---

Fix two ASCII rendering fidelity bugs found by the weekly form-judge audit: a subgraph cluster label wider than its child nodes was truncated mid-word (e.g. "Processing Pipeline" became "Processing Pipe") instead of widening the box to fit; and two different class-diagram relationships converging on the same target class from different sources (e.g. `Teacher --> Course` and `Student --> Course`) collapsed onto the same connection column, making one connector look like it stopped short of its target instead of reaching it with its own arrowhead.
