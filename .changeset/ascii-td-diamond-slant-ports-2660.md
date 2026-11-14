---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: in a top-down or bottom-up flow, a decision with two branches on its flow face (`B{Tests Pass?}` with `Yes` and `No`) now leaves each branch from a lower slant, either side of the bottom vertex, as mermaid@12.3.0 draws them, instead of two adjacent stems under the vertex. Needs the ELK layout provider (registered by default in `zombie-mermaid`'s entry points).
