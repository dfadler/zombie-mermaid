---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: a left-to-right fan-out in ASCII now leaves the source's right face and enters each target's left face, as Mermaid draws it, instead of leaving the top and bottom faces. The bend sits just after the source, each label rides its own run, and mixed line styles stay on separate segments. Reciprocal pairs, self-loops at the source, subgraph members and centred fan-outs keep their routing.
