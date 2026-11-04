---
'@zombie-mermaid/ascii-renderer': patch
---

Output change: ASCII class diagrams now match Mermaid 12.3.0 more closely. Every class box draws all three compartments (name, attributes, methods), even when one is empty. Names and annotations are centred, an annotation is written `«interface»` (`<<interface>>` with `useAscii`), a method prints as `+start() : void`, and association and dependency heads are open `v ^ < >` instead of filled triangles.
