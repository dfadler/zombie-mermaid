---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: in ASCII sequence diagrams a note written after a block's `end` is drawn below that block's frame (as in Mermaid 12.3.0), not inside it. A note after a nested block's `end` stays inside the enclosing block.
