---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: an LR flowchart with a labelled edge that is a parallel-lane sibling into a decision (`n0 -->|a| n1` and `n3 -->|0| n1` alongside `n2 --> n1`) no longer throws `Cannot read properties of undefined (reading 'x')`. The edge's label line is now chosen by the ordinary search instead of being left unset.
