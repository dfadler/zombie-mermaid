---
'zombie-mermaid': patch
'@zombie-mermaid/ascii-renderer': patch
---

ASCII: in a left-to-right or right-to-left flow, a decision with three ends on its entry face (the way in and two returns, as `G{Tests?}` in the Git Branching Workflow sample) gives each end its own cell, on the vertex and the two slants, as mermaid@12.3.0 draws it, instead of ending the arrowhead and both returns on one shared stem. Needs the ELK layout provider (registered by default in `zombie-mermaid`'s entry points).
