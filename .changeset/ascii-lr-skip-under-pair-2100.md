---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII, `LR`/`RL`: a skip edge beside a reciprocal pair (`b --> c` over `a`, with `a --> c` and `c --> a`) now runs under the row from its own bottom faces, so it no longer reads as a branch of the edge into `a` or ends inside `a --> c`. The pair is drawn as two strokes between the facing side faces, and a self-loop on `a` sits above it (#2100).
