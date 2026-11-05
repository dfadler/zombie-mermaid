---
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: a dense group of reciprocal edges between two neighbouring boxes (LR/RL) now draws one stroke per edge between the facing side faces, with self-loops over the top, as Mermaid does, instead of running eight edges round the bottom.
