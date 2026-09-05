---
'zombie-mermaid': minor
---

Sequence diagrams: Mermaid's standalone `activate X` / `deactivate X` statements are now recognized. They feed the same activation stack as the inline `+`/`-` arrow shorthand, so `A->>B: m` + `activate B` renders byte-for-byte the same as `A->>+B: m`, the two spellings can be mixed on one actor, and activations stack (nest) the same way in either form. Previously the standalone lines were silently dropped and no activation bar was drawn.
