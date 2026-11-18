---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

Output change, ASCII: in a left-to-right or right-to-left diagram, a back edge whose run has to clear another stroke of its source now rises beside its target, and a forward edge across more than one layer drops beside its target, as mermaid@12.3.0 bends them (`Git Branching Workflow` pass return, `Edges Into and Out of Subgraphs` Cluster-to-Audit). Both used to bend beside the source.
