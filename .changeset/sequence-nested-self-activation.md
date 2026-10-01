---
'zombie-mermaid': patch
'@zombie-mermaid/mermaid-parser': patch
'@zombie-mermaid/svg-renderer': patch
---

Sequence diagrams: a nested activation (for example `S->>+S` while `S` is already active) now draws an outer bar and a nested bar offset half a bar to the right, as official Mermaid does. Before, the nested bar was offset only 4px and painted underneath its parent, so it showed as a sliver and read as a single bar. The positioned `Activation` gains a `depth` field. Closes #1241.
